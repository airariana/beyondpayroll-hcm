#!/usr/bin/env python3
"""
Sales Cadence MCP Server

A multi-channel sales outreach agent that manages prospects and executes
cadence sequences across phone (Twilio), email (SendGrid), and SMS (Twilio).
"""

import csv
import io
import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

sys.path.insert(0, str(Path(__file__).parent))

from cadence_engine import execute_pending_steps
from channels.email import send_email
from channels.phone import make_call
from channels.sms import send_sms
from config import Config
from db import Database
from models import (
    CreateCadenceInput,
    DeleteCadenceInput,
    DeleteProspectInput,
    EnrollProspectsInput,
    ExecutePendingStepsInput,
    GetActivityLogInput,
    GetCadenceInput,
    GetCadenceStatsInput,
    GetEnrollmentsInput,
    GetProspectInput,
    ImportProspectsInput,
    ListCadencesInput,
    ListProspectsInput,
    MakeCallInput,
    PauseResumeEnrollmentInput,
    ResponseFormat,
    SendEmailInput,
    SendSmsInput,
    UpdateCadenceInput,
    UpdateProspectInput,
)
from templates import render_template


# ── Server Setup ──────────────────────────────────────────────────────

@asynccontextmanager
async def app_lifespan():
    config = Config.from_env()
    db = Database(config.database_path)
    yield {"config": config, "db": db}


mcp = FastMCP("sales_cadence_mcp", lifespan=app_lifespan)


def _get_state(ctx) -> tuple[Database, Config]:
    state = ctx.request_context.lifespan_state
    return state["db"], state["config"]


# ── Formatting Helpers ────────────────────────────────────────────────

def _format_prospect_md(p: dict) -> str:
    lines = [f"### {p['name']} ({p['id']})"]
    if p.get("title"):
        lines.append(f"- **Title**: {p['title']}")
    if p.get("company"):
        lines.append(f"- **Company**: {p['company']}")
    if p.get("email"):
        lines.append(f"- **Email**: {p['email']}")
    if p.get("phone"):
        lines.append(f"- **Phone**: {p['phone']}")
    lines.append(f"- **Status**: {p['status']}")
    if p.get("custom_fields") and isinstance(p["custom_fields"], dict) and p["custom_fields"]:
        lines.append(f"- **Custom**: {json.dumps(p['custom_fields'])}")
    return "\n".join(lines)


def _format_cadence_md(c: dict) -> str:
    steps = c.get("steps", [])
    lines = [
        f"### {c['name']} ({c['id']})",
        f"- **Active**: {'Yes' if c.get('active') else 'No'}",
        f"- **Steps**: {len(steps)}",
    ]
    for i, s in enumerate(steps):
        lines.append(f"  {i+1}. **{s['channel'].upper()}** after {s['delay_days']}d — {s.get('template', '')[:80]}...")
    return "\n".join(lines)


def _format_enrollment_md(e: dict) -> str:
    return (
        f"- **{e.get('prospect_name', e['prospect_id'])}** "
        f"in *{e.get('cadence_name', e['cadence_id'])}* — "
        f"Step {e['current_step'] + 1}, Status: {e['status']}"
    )


def _format_activity_md(a: dict) -> str:
    return (
        f"- [{a['created_at'][:19]}] **{a['channel'].upper()}** → "
        f"{a.get('prospect_name', a['prospect_id'])}: {a['action']}"
    )


# ═══════════════════════════════════════════════════════════════════════
# PROSPECT MANAGEMENT TOOLS
# ═══════════════════════════════════════════════════════════════════════

@mcp.tool(
    name="sales_import_prospects",
    annotations={
        "title": "Import Prospects",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def sales_import_prospects(params: ImportProspectsInput, ctx: Any) -> str:
    """Import prospects from a CSV or JSON file into the database.

    CSV files should have headers: name, company, phone, email, title.
    JSON files should be an array of objects with the same fields.
    Duplicates are detected by the 'deduplicate_on' field (default: email).
    """
    db, config = _get_state(ctx)
    path = Path(params.file_path)

    if not path.exists():
        return f"Error: File not found: {params.file_path}"

    content = path.read_text(encoding="utf-8")
    records: list[dict] = []

    if path.suffix.lower() == ".json":
        try:
            records = json.loads(content)
        except json.JSONDecodeError as e:
            return f"Error: Invalid JSON — {e}"
    elif path.suffix.lower() == ".csv":
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            records.append(dict(row))
    else:
        return f"Error: Unsupported file type '{path.suffix}'. Use .csv or .json."

    if not records:
        return "Error: No records found in file."

    imported, skipped, errors = 0, 0, 0
    known_fields = {"name", "company", "phone", "email", "title", "status"}

    for rec in records:
        name = rec.get("name", "").strip()
        if not name:
            errors += 1
            continue

        dedup_field = params.deduplicate_on or "email"
        dedup_value = rec.get(dedup_field, "").strip()
        if dedup_value and db.prospect_exists_by_field(dedup_field, dedup_value):
            skipped += 1
            continue

        custom = {k: v for k, v in rec.items() if k not in known_fields and v}

        db.create_prospect(
            name=name,
            company=rec.get("company", ""),
            phone=rec.get("phone", ""),
            email=rec.get("email", ""),
            title=rec.get("title", ""),
            status=rec.get("status", "new"),
            custom_fields=custom if custom else None,
        )
        imported += 1

    return (
        f"# Import Complete\n\n"
        f"- **Imported**: {imported}\n"
        f"- **Skipped (duplicates)**: {skipped}\n"
        f"- **Errors**: {errors}\n"
        f"- **Total in file**: {len(records)}"
    )


@mcp.tool(
    name="sales_list_prospects",
    annotations={
        "title": "List Prospects",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_list_prospects(params: ListProspectsInput, ctx: Any) -> str:
    """List and search prospects with filtering, pagination, and multiple output formats."""
    db, _ = _get_state(ctx)
    result = db.list_prospects(
        status=params.status.value if params.status else None,
        company=params.company,
        search=params.search,
        limit=params.limit,
        offset=params.offset,
    )

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(result, indent=2)

    if not result["prospects"]:
        return "No prospects found matching your criteria."

    lines = [f"# Prospects ({result['total']} total, showing {result['count']})\n"]
    for p in result["prospects"]:
        lines.append(_format_prospect_md(p))
        lines.append("")

    if result["has_more"]:
        lines.append(f"*More results available. Use offset={result['offset'] + result['count']} to see next page.*")

    return "\n".join(lines)


@mcp.tool(
    name="sales_get_prospect",
    annotations={
        "title": "Get Prospect Details",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_get_prospect(params: GetProspectInput, ctx: Any) -> str:
    """Get full details for a single prospect by ID."""
    db, _ = _get_state(ctx)
    p = db.get_prospect(params.prospect_id)
    if not p:
        return f"Error: Prospect '{params.prospect_id}' not found."

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(p, indent=2)

    return _format_prospect_md(p)


@mcp.tool(
    name="sales_update_prospect",
    annotations={
        "title": "Update Prospect",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_update_prospect(params: UpdateProspectInput, ctx: Any) -> str:
    """Update a prospect's information, status, or custom fields."""
    db, _ = _get_state(ctx)
    updates = {}
    if params.name is not None:
        updates["name"] = params.name
    if params.company is not None:
        updates["company"] = params.company
    if params.phone is not None:
        updates["phone"] = params.phone
    if params.email is not None:
        updates["email"] = params.email
    if params.title is not None:
        updates["title"] = params.title
    if params.status is not None:
        updates["status"] = params.status.value
    if params.custom_fields is not None:
        updates["custom_fields"] = params.custom_fields

    result = db.update_prospect(params.prospect_id, **updates)
    if not result:
        return f"Error: Prospect '{params.prospect_id}' not found."

    return f"Prospect updated successfully.\n\n{_format_prospect_md(result)}"


@mcp.tool(
    name="sales_delete_prospect",
    annotations={
        "title": "Delete Prospect",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def sales_delete_prospect(params: DeleteProspectInput, ctx: Any) -> str:
    """Delete a prospect and all their associated enrollments and activity logs."""
    db, _ = _get_state(ctx)
    if db.delete_prospect(params.prospect_id):
        return f"Prospect '{params.prospect_id}' deleted successfully."
    return f"Error: Prospect '{params.prospect_id}' not found."


# ═══════════════════════════════════════════════════════════════════════
# CADENCE MANAGEMENT TOOLS
# ═══════════════════════════════════════════════════════════════════════

@mcp.tool(
    name="sales_create_cadence",
    annotations={
        "title": "Create Cadence",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def sales_create_cadence(params: CreateCadenceInput, ctx: Any) -> str:
    """Create a new multi-step outreach cadence.

    Each step defines a channel (phone/email/sms), a delay in days from the
    previous step, and a message template with Jinja2 variables.
    """
    db, _ = _get_state(ctx)
    steps_data = [s.model_dump() for s in params.steps]
    cadence = db.create_cadence(name=params.name, steps=steps_data)
    return f"Cadence created successfully.\n\n{_format_cadence_md(cadence)}"


@mcp.tool(
    name="sales_list_cadences",
    annotations={
        "title": "List Cadences",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_list_cadences(params: ListCadencesInput, ctx: Any) -> str:
    """List all cadences, optionally filtering to active ones only."""
    db, _ = _get_state(ctx)
    cadences = db.list_cadences(active_only=params.active_only)

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(cadences, indent=2)

    if not cadences:
        return "No cadences found."

    lines = [f"# Cadences ({len(cadences)})\n"]
    for c in cadences:
        lines.append(_format_cadence_md(c))
        lines.append("")
    return "\n".join(lines)


@mcp.tool(
    name="sales_get_cadence",
    annotations={
        "title": "Get Cadence Details",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_get_cadence(params: GetCadenceInput, ctx: Any) -> str:
    """Get full details for a cadence including all steps."""
    db, _ = _get_state(ctx)
    c = db.get_cadence(params.cadence_id)
    if not c:
        return f"Error: Cadence '{params.cadence_id}' not found."

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(c, indent=2)

    return _format_cadence_md(c)


@mcp.tool(
    name="sales_update_cadence",
    annotations={
        "title": "Update Cadence",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_update_cadence(params: UpdateCadenceInput, ctx: Any) -> str:
    """Update a cadence's name, steps, or active status."""
    db, _ = _get_state(ctx)
    updates = {}
    if params.name is not None:
        updates["name"] = params.name
    if params.steps is not None:
        updates["steps"] = [s.model_dump() for s in params.steps]
    if params.active is not None:
        updates["active"] = params.active

    result = db.update_cadence(params.cadence_id, **updates)
    if not result:
        return f"Error: Cadence '{params.cadence_id}' not found."

    return f"Cadence updated successfully.\n\n{_format_cadence_md(result)}"


@mcp.tool(
    name="sales_delete_cadence",
    annotations={
        "title": "Delete Cadence",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def sales_delete_cadence(params: DeleteCadenceInput, ctx: Any) -> str:
    """Delete a cadence. Active enrollments will stop executing."""
    db, _ = _get_state(ctx)
    if db.delete_cadence(params.cadence_id):
        return f"Cadence '{params.cadence_id}' deleted successfully."
    return f"Error: Cadence '{params.cadence_id}' not found."


# ═══════════════════════════════════════════════════════════════════════
# ENROLLMENT & EXECUTION TOOLS
# ═══════════════════════════════════════════════════════════════════════

@mcp.tool(
    name="sales_enroll_prospects",
    annotations={
        "title": "Enroll Prospects in Cadence",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def sales_enroll_prospects(params: EnrollProspectsInput, ctx: Any) -> str:
    """Enroll one or more prospects into a cadence."""
    db, _ = _get_state(ctx)

    cadence = db.get_cadence(params.cadence_id)
    if not cadence:
        return f"Error: Cadence '{params.cadence_id}' not found."

    enrolled, errors = 0, []
    for pid in params.prospect_ids:
        prospect = db.get_prospect(pid)
        if not prospect:
            errors.append(f"Prospect '{pid}' not found")
            continue
        if prospect["status"] == "do_not_contact":
            errors.append(f"Prospect '{pid}' ({prospect['name']}) is marked do_not_contact")
            continue

        db.create_enrollment(pid, params.cadence_id)
        enrolled += 1

    lines = [
        f"# Enrollment Complete",
        f"- **Enrolled**: {enrolled} prospects into *{cadence['name']}*",
    ]
    if errors:
        lines.append(f"- **Errors**: {len(errors)}")
        for e in errors:
            lines.append(f"  - {e}")

    return "\n".join(lines)


@mcp.tool(
    name="sales_get_enrollments",
    annotations={
        "title": "List Enrollments",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_get_enrollments(params: GetEnrollmentsInput, ctx: Any) -> str:
    """List cadence enrollments with optional filters."""
    db, _ = _get_state(ctx)
    result = db.list_enrollments(
        cadence_id=params.cadence_id,
        prospect_id=params.prospect_id,
        status=params.status.value if params.status else None,
        limit=params.limit,
        offset=params.offset,
    )

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(result, indent=2)

    if not result["enrollments"]:
        return "No enrollments found."

    lines = [f"# Enrollments ({result['total']} total)\n"]
    for e in result["enrollments"]:
        lines.append(_format_enrollment_md(e))
    if result["has_more"]:
        lines.append(f"\n*More results available. Use offset={result['offset'] + result['count']}*")
    return "\n".join(lines)


@mcp.tool(
    name="sales_pause_enrollment",
    annotations={
        "title": "Pause Enrollment",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_pause_enrollment(params: PauseResumeEnrollmentInput, ctx: Any) -> str:
    """Pause an active enrollment."""
    db, _ = _get_state(ctx)
    if db.update_enrollment_status(params.enrollment_id, "paused"):
        return f"Enrollment '{params.enrollment_id}' paused."
    return f"Error: Enrollment '{params.enrollment_id}' not found."


@mcp.tool(
    name="sales_resume_enrollment",
    annotations={
        "title": "Resume Enrollment",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_resume_enrollment(params: PauseResumeEnrollmentInput, ctx: Any) -> str:
    """Resume a paused enrollment."""
    db, _ = _get_state(ctx)
    if db.update_enrollment_status(params.enrollment_id, "active"):
        return f"Enrollment '{params.enrollment_id}' resumed."
    return f"Error: Enrollment '{params.enrollment_id}' not found."


@mcp.tool(
    name="sales_execute_pending_steps",
    annotations={
        "title": "Execute Pending Cadence Steps",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    },
)
async def sales_execute_pending_steps(params: ExecutePendingStepsInput, ctx: Any) -> str:
    """Execute all cadence steps that are due right now.

    This is the main 'run' command. Use dry_run=True to preview without sending.
    """
    db, config = _get_state(ctx)
    result = await execute_pending_steps(
        db=db,
        config=config,
        cadence_id=params.cadence_id,
        dry_run=params.dry_run,
        limit=params.limit,
    )

    lines = [
        f"# Cadence Execution {'(DRY RUN)' if params.dry_run else 'Complete'}\n",
        f"- **Pending**: {result['total_pending']}",
        f"- **Executed**: {result['executed']}",
        f"- **Failed**: {result['failed']}",
        f"- **Skipped**: {result['skipped']}",
    ]

    if result["details"]:
        lines.append("\n## Details\n")
        for d in result["details"]:
            status_icon = "✓" if d["status"] == "success" else "✗" if d["status"] == "failed" else "○"
            lines.append(
                f"- {status_icon} **{d['prospect_name']}** ({d['cadence_name']} step {d['step']}) "
                f"via {d['channel'].upper()}: {d['status']}"
            )
            if d.get("error"):
                lines.append(f"  - Error: {d['error']}")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════
# DIRECT CHANNEL ACTION TOOLS
# ═══════════════════════════════════════════════════════════════════════

@mcp.tool(
    name="sales_send_email",
    annotations={
        "title": "Send Email",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    },
)
async def sales_send_email(params: SendEmailInput, ctx: Any) -> str:
    """Send a one-off email to a prospect (outside of any cadence)."""
    db, config = _get_state(ctx)
    prospect = db.get_prospect(params.prospect_id)
    if not prospect:
        return f"Error: Prospect '{params.prospect_id}' not found."
    if not prospect["email"]:
        return f"Error: Prospect '{prospect['name']}' has no email address."

    rendered_body = render_template(params.body, prospect)
    rendered_subject = render_template(params.subject, prospect)

    result = await send_email(
        config=config,
        to_email=prospect["email"],
        to_name=prospect["name"],
        subject=rendered_subject,
        body=rendered_body,
        is_html=params.is_html,
    )

    if result["success"]:
        db.log_activity(params.prospect_id, "email", "email_sent", {
            "subject": rendered_subject,
            "message_id": result.get("message_id"),
        })
        return f"Email sent to {prospect['name']} ({prospect['email']}).\nMessage ID: {result.get('message_id')}"
    return f"Error sending email: {result.get('error')}"


@mcp.tool(
    name="sales_send_sms",
    annotations={
        "title": "Send SMS",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    },
)
async def sales_send_sms(params: SendSmsInput, ctx: Any) -> str:
    """Send a one-off SMS to a prospect (outside of any cadence)."""
    db, config = _get_state(ctx)
    prospect = db.get_prospect(params.prospect_id)
    if not prospect:
        return f"Error: Prospect '{params.prospect_id}' not found."
    if not prospect["phone"]:
        return f"Error: Prospect '{prospect['name']}' has no phone number."

    rendered = render_template(params.message, prospect)

    result = await send_sms(config=config, to_phone=prospect["phone"], message=rendered)

    if result["success"]:
        db.log_activity(params.prospect_id, "sms", "sms_sent", {
            "message_preview": rendered[:160],
            "sid": result.get("sid"),
        })
        return f"SMS sent to {prospect['name']} ({prospect['phone']}).\nSID: {result.get('sid')}"
    return f"Error sending SMS: {result.get('error')}"


@mcp.tool(
    name="sales_make_call",
    annotations={
        "title": "Make Phone Call",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    },
)
async def sales_make_call(params: MakeCallInput, ctx: Any) -> str:
    """Initiate a phone call to a prospect with an AI-spoken script."""
    db, config = _get_state(ctx)
    prospect = db.get_prospect(params.prospect_id)
    if not prospect:
        return f"Error: Prospect '{params.prospect_id}' not found."
    if not prospect["phone"]:
        return f"Error: Prospect '{prospect['name']}' has no phone number."

    rendered = render_template(params.script, prospect)

    result = await make_call(
        config=config,
        to_phone=prospect["phone"],
        script=rendered,
        voice=params.voice,
    )

    if result["success"]:
        db.log_activity(params.prospect_id, "phone", "call_made", {
            "script_preview": rendered[:500],
            "sid": result.get("sid"),
            "voice": params.voice,
        })
        return (
            f"Call initiated to {prospect['name']} ({prospect['phone']}).\n"
            f"Call SID: {result.get('sid')}\nStatus: {result.get('status')}"
        )
    return f"Error making call: {result.get('error')}"


# ═══════════════════════════════════════════════════════════════════════
# REPORTING TOOLS
# ═══════════════════════════════════════════════════════════════════════

@mcp.tool(
    name="sales_get_activity_log",
    annotations={
        "title": "Get Activity Log",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_get_activity_log(params: GetActivityLogInput, ctx: Any) -> str:
    """View the outreach activity history."""
    db, _ = _get_state(ctx)
    result = db.get_activity_log(
        prospect_id=params.prospect_id,
        channel=params.channel.value if params.channel else None,
        limit=params.limit,
        offset=params.offset,
    )

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(result, indent=2)

    if not result["activities"]:
        return "No activity found."

    lines = [f"# Activity Log ({result['total']} total)\n"]
    for a in result["activities"]:
        lines.append(_format_activity_md(a))
    if result["has_more"]:
        lines.append(f"\n*More results available. Use offset={result['offset'] + result['count']}*")
    return "\n".join(lines)


@mcp.tool(
    name="sales_get_cadence_stats",
    annotations={
        "title": "Get Cadence Statistics",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sales_get_cadence_stats(params: GetCadenceStatsInput, ctx: Any) -> str:
    """Get performance statistics for a cadence."""
    db, _ = _get_state(ctx)
    stats = db.get_cadence_stats(params.cadence_id)
    if not stats:
        return f"Error: Cadence '{params.cadence_id}' not found."

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(stats, indent=2)

    breakdown = stats.get("status_breakdown", {})
    channels = stats.get("activities_by_channel", {})

    lines = [
        f"# Cadence Stats: {stats['cadence_name']}\n",
        f"- **Total Enrolled**: {stats['total_enrolled']}",
        f"- **Reply Rate**: {stats['reply_rate']}",
        "",
        "## Enrollment Status",
    ]
    for status, count in breakdown.items():
        lines.append(f"- {status}: {count}")

    if channels:
        lines.append("\n## Activities by Channel")
        for ch, count in channels.items():
            lines.append(f"- {ch}: {count}")

    return "\n".join(lines)


# ── Entry Point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run()
