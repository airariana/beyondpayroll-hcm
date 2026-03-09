#!/usr/bin/env python3
"""
REST API Bridge for Sales Cadence MCP Server.

A lightweight HTTP server that exposes the MCP server's prospect management,
cadence execution, and direct channel actions (SMS, phone, email) as REST
endpoints. Designed to be called from the BeyondPayroll HCM web app.

Run alongside the MCP server:
    python api_bridge.py

Defaults to http://localhost:8787 (configurable via API_PORT env var).
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from aiohttp import web

sys.path.insert(0, str(Path(__file__).parent))

from cadence_engine import execute_pending_steps
from channels.email import send_email
from channels.phone import make_call
from channels.sms import send_sms
from config import Config
from db import Database
from templates import render_template

# ── Globals ───────────────────────────────────────────────────────────

config = Config.from_env()
db = Database(config.database_path)

PORT = int(os.getenv("API_PORT", "8787"))

# ── CORS Middleware ───────────────────────────────────────────────────

@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        resp = web.Response(status=200)
    else:
        try:
            resp = await handler(request)
        except web.HTTPException as ex:
            resp = ex
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    return resp


def json_response(data, status=200):
    return web.json_response(data, status=status)


def error_response(msg, status=400):
    return web.json_response({"success": False, "error": msg}, status=status)


# ═══════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════

async def health(request):
    twilio_ok = not config.validate_twilio()
    sendgrid_ok = not config.validate_sendgrid()
    return json_response({
        "status": "ok",
        "twilio_configured": twilio_ok,
        "sendgrid_configured": sendgrid_ok,
        "database": config.database_path,
    })


# ═══════════════════════════════════════════════════════════════════════
# PROSPECT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

async def list_prospects(request):
    status = request.query.get("status")
    company = request.query.get("company")
    search = request.query.get("search")
    limit = int(request.query.get("limit", 50))
    offset = int(request.query.get("offset", 0))
    result = db.list_prospects(
        status=status, company=company, search=search,
        limit=limit, offset=offset,
    )
    return json_response(result)


async def get_prospect(request):
    pid = request.match_info["id"]
    p = db.get_prospect(pid)
    if not p:
        return error_response(f"Prospect '{pid}' not found", 404)
    return json_response(p)


async def create_prospect(request):
    data = await request.json()
    name = data.get("name", "").strip()
    if not name:
        return error_response("'name' is required")

    p = db.create_prospect(
        name=name,
        company=data.get("company", ""),
        phone=data.get("phone", ""),
        email=data.get("email", ""),
        title=data.get("title", ""),
        status=data.get("status", "new"),
        custom_fields=data.get("custom_fields"),
    )
    return json_response({"success": True, "prospect": p}, status=201)


async def update_prospect(request):
    pid = request.match_info["id"]
    data = await request.json()
    result = db.update_prospect(pid, **data)
    if not result:
        return error_response(f"Prospect '{pid}' not found", 404)
    return json_response({"success": True, "prospect": result})


async def delete_prospect(request):
    pid = request.match_info["id"]
    if db.delete_prospect(pid):
        return json_response({"success": True})
    return error_response(f"Prospect '{pid}' not found", 404)


async def sync_prospects(request):
    """Bulk upsert prospects from the web app (localStorage/Firebase sync)."""
    data = await request.json()
    prospects = data.get("prospects", [])
    if not prospects:
        return error_response("'prospects' array is required")

    created, updated, errors = 0, 0, 0

    for p in prospects:
        name = p.get("name") or p.get("contact", "").strip()
        if not name:
            errors += 1
            continue

        # Check if prospect already exists by email or name+company
        existing = None
        if p.get("email"):
            existing = db.find_prospect_by_email(p["email"])
        if not existing and p.get("company"):
            existing = db.find_prospect_by_name_company(name, p["company"])

        custom = {
            k: v for k, v in p.items()
            if k not in ("name", "contact", "company", "phone", "email", "title", "status")
            and v
        }

        if existing:
            db.update_prospect(
                existing["id"],
                name=name,
                company=p.get("company", existing.get("company", "")),
                phone=p.get("phone", existing.get("phone", "")),
                email=p.get("email", existing.get("email", "")),
                title=p.get("title") or p.get("persona", existing.get("title", "")),
                custom_fields=custom or existing.get("custom_fields"),
            )
            updated += 1
        else:
            db.create_prospect(
                name=name,
                company=p.get("company", ""),
                phone=p.get("phone", ""),
                email=p.get("email", ""),
                title=p.get("title") or p.get("persona", ""),
                status="new",
                custom_fields=custom if custom else None,
            )
            created += 1

    return json_response({
        "success": True,
        "created": created,
        "updated": updated,
        "errors": errors,
        "total": len(prospects),
    })


# ═══════════════════════════════════════════════════════════════════════
# CADENCE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

async def list_cadences(request):
    active_only = request.query.get("active_only", "false").lower() == "true"
    cadences = db.list_cadences(active_only=active_only)
    return json_response({"cadences": cadences})


async def get_cadence(request):
    cid = request.match_info["id"]
    c = db.get_cadence(cid)
    if not c:
        return error_response(f"Cadence '{cid}' not found", 404)
    return json_response(c)


async def create_cadence(request):
    data = await request.json()
    name = data.get("name", "").strip()
    steps = data.get("steps", [])
    if not name:
        return error_response("'name' is required")
    if not steps:
        return error_response("'steps' array is required")
    c = db.create_cadence(name=name, steps=steps)
    return json_response({"success": True, "cadence": c}, status=201)


async def enroll_prospects(request):
    data = await request.json()
    cadence_id = data.get("cadence_id", "").strip()
    prospect_ids = data.get("prospect_ids", [])
    if not cadence_id:
        return error_response("'cadence_id' is required")
    if not prospect_ids:
        return error_response("'prospect_ids' array is required")

    cadence = db.get_cadence(cadence_id)
    if not cadence:
        return error_response(f"Cadence '{cadence_id}' not found", 404)

    enrolled, errs = 0, []
    for pid in prospect_ids:
        prospect = db.get_prospect(pid)
        if not prospect:
            errs.append(f"Prospect '{pid}' not found")
            continue
        if prospect["status"] == "do_not_contact":
            errs.append(f"Prospect '{pid}' is do_not_contact")
            continue
        db.create_enrollment(pid, cadence_id)
        enrolled += 1

    return json_response({
        "success": True,
        "enrolled": enrolled,
        "errors": errs,
    })


async def execute_pending(request):
    data = await request.json() if request.can_read_body else {}
    cadence_id = data.get("cadence_id")
    dry_run = data.get("dry_run", False)
    limit = data.get("limit", 50)

    result = await execute_pending_steps(
        db=db, config=config,
        cadence_id=cadence_id, dry_run=dry_run, limit=limit,
    )
    return json_response(result)


async def list_enrollments(request):
    cadence_id = request.query.get("cadence_id")
    prospect_id = request.query.get("prospect_id")
    status = request.query.get("status")
    limit = int(request.query.get("limit", 50))
    offset = int(request.query.get("offset", 0))
    result = db.list_enrollments(
        cadence_id=cadence_id, prospect_id=prospect_id,
        status=status, limit=limit, offset=offset,
    )
    return json_response(result)


# ═══════════════════════════════════════════════════════════════════════
# DIRECT CHANNEL ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

async def send_sms_endpoint(request):
    data = await request.json()
    to_phone = data.get("to_phone", "").strip()
    message = data.get("message", "").strip()
    prospect_id = data.get("prospect_id")

    if not to_phone:
        return error_response("'to_phone' is required")
    if not message:
        return error_response("'message' is required")

    # Optionally render template if prospect_id provided
    if prospect_id:
        prospect = db.get_prospect(prospect_id)
        if prospect:
            message = render_template(message, prospect)

    result = await send_sms(config=config, to_phone=to_phone, message=message)

    if result["success"]:
        if prospect_id:
            db.log_activity(prospect_id, "sms", "sms_sent", {
                "message_preview": message[:160],
                "sid": result.get("sid"),
            })
        return json_response({
            "success": True,
            "sid": result.get("sid"),
            "status": result.get("status"),
        })
    return error_response(result.get("error", "SMS send failed"))


async def make_call_endpoint(request):
    data = await request.json()
    to_phone = data.get("to_phone", "").strip()
    script = data.get("script", "").strip()
    voice = data.get("voice", "Polly.Matthew")
    prospect_id = data.get("prospect_id")

    if not to_phone:
        return error_response("'to_phone' is required")
    if not script:
        return error_response("'script' is required")

    if prospect_id:
        prospect = db.get_prospect(prospect_id)
        if prospect:
            script = render_template(script, prospect)

    result = await make_call(
        config=config, to_phone=to_phone, script=script, voice=voice,
    )

    if result["success"]:
        if prospect_id:
            db.log_activity(prospect_id, "phone", "call_made", {
                "script_preview": script[:500],
                "sid": result.get("sid"),
                "voice": voice,
            })
        return json_response({
            "success": True,
            "sid": result.get("sid"),
            "status": result.get("status"),
        })
    return error_response(result.get("error", "Call failed"))


async def send_email_endpoint(request):
    data = await request.json()
    to_email = data.get("to_email", "").strip()
    to_name = data.get("to_name", "").strip()
    subject = data.get("subject", "").strip()
    body = data.get("body", "").strip()
    is_html = data.get("is_html", False)
    prospect_id = data.get("prospect_id")

    if not to_email:
        return error_response("'to_email' is required")
    if not body:
        return error_response("'body' is required")

    if prospect_id:
        prospect = db.get_prospect(prospect_id)
        if prospect:
            body = render_template(body, prospect)
            subject = render_template(subject, prospect) if subject else ""

    result = await send_email(
        config=config, to_email=to_email, to_name=to_name,
        subject=subject, body=body, is_html=is_html,
    )

    if result["success"]:
        if prospect_id:
            db.log_activity(prospect_id, "email", "email_sent", {
                "subject": subject,
                "message_id": result.get("message_id"),
            })
        return json_response({
            "success": True,
            "status_code": result.get("status_code"),
            "message_id": result.get("message_id"),
        })
    return error_response(result.get("error", "Email send failed"))


# ═══════════════════════════════════════════════════════════════════════
# ACTIVITY LOG
# ═══════════════════════════════════════════════════════════════════════

async def get_activity_log(request):
    prospect_id = request.query.get("prospect_id")
    channel = request.query.get("channel")
    limit = int(request.query.get("limit", 50))
    offset = int(request.query.get("offset", 0))
    result = db.get_activity_log(
        prospect_id=prospect_id, channel=channel,
        limit=limit, offset=offset,
    )
    return json_response(result)


async def get_cadence_stats(request):
    cid = request.match_info["id"]
    stats = db.get_cadence_stats(cid)
    if not stats:
        return error_response(f"Cadence '{cid}' not found", 404)
    return json_response(stats)


# ═══════════════════════════════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════════════════════════════

def create_app():
    app = web.Application(middlewares=[cors_middleware])

    # Health
    app.router.add_get("/api/health", health)

    # Prospects
    app.router.add_get("/api/prospects", list_prospects)
    app.router.add_post("/api/prospects", create_prospect)
    app.router.add_post("/api/prospects/sync", sync_prospects)
    app.router.add_get("/api/prospects/{id}", get_prospect)
    app.router.add_put("/api/prospects/{id}", update_prospect)
    app.router.add_delete("/api/prospects/{id}", delete_prospect)

    # Cadences
    app.router.add_get("/api/cadences", list_cadences)
    app.router.add_post("/api/cadences", create_cadence)
    app.router.add_get("/api/cadences/{id}", get_cadence)
    app.router.add_get("/api/cadences/{id}/stats", get_cadence_stats)

    # Enrollments
    app.router.add_get("/api/enrollments", list_enrollments)
    app.router.add_post("/api/enrollments", enroll_prospects)
    app.router.add_post("/api/enrollments/execute", execute_pending)

    # Direct channel actions
    app.router.add_post("/api/send/sms", send_sms_endpoint)
    app.router.add_post("/api/send/call", make_call_endpoint)
    app.router.add_post("/api/send/email", send_email_endpoint)

    # Activity
    app.router.add_get("/api/activity", get_activity_log)

    return app


if __name__ == "__main__":
    print(f"Sales Cadence API Bridge starting on http://localhost:{PORT}")
    print("Endpoints: /api/health, /api/prospects, /api/cadences, /api/send/sms, /api/send/call, /api/send/email")
    app = create_app()
    web.run_app(app, host="0.0.0.0", port=PORT)
