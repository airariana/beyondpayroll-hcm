"""Cadence execution engine — runs pending steps across all channels."""

from typing import Any, Optional

from channels.email import send_email
from channels.phone import make_call
from channels.sms import send_sms
from config import Config
from db import Database
from templates import render_template


async def execute_pending_steps(
    db: Database,
    config: Config,
    cadence_id: Optional[str] = None,
    dry_run: bool = False,
    limit: int = 50,
) -> dict[str, Any]:
    """Execute all cadence steps that are due."""
    pending = db.get_pending_enrollments(cadence_id=cadence_id, limit=limit)

    results = {
        "total_pending": len(pending),
        "executed": 0,
        "failed": 0,
        "skipped": 0,
        "details": [],
    }

    for enrollment in pending:
        steps = enrollment.get("cadence_steps", [])
        step_idx = enrollment["current_step"]

        if step_idx >= len(steps):
            db.update_enrollment_status(enrollment["id"], "completed")
            results["skipped"] += 1
            continue

        step = steps[step_idx]
        channel = step["channel"]
        template = step.get("template", "")
        subject = step.get("subject", "")

        prospect = {
            "name": enrollment.get("name", ""),
            "company": enrollment.get("company", ""),
            "title": enrollment.get("title", ""),
            "email": enrollment.get("email", ""),
            "phone": enrollment.get("phone", ""),
            "custom_fields": enrollment.get("custom_fields", {}),
        }

        rendered_body = render_template(template, prospect)
        rendered_subject = render_template(subject, prospect) if subject else ""

        detail = {
            "enrollment_id": enrollment["id"],
            "prospect_id": enrollment["prospect_id"],
            "prospect_name": prospect["name"],
            "cadence_name": enrollment.get("cadence_name", ""),
            "step": step_idx + 1,
            "channel": channel,
            "message_preview": rendered_body[:200],
        }

        if dry_run:
            detail["status"] = "dry_run"
            results["details"].append(detail)
            results["executed"] += 1
            continue

        result = None
        action = ""

        if channel == "email":
            if not prospect["email"]:
                detail["status"] = "skipped"
                detail["error"] = "No email address"
                results["skipped"] += 1
                results["details"].append(detail)
                continue

            result = await send_email(
                config=config,
                to_email=prospect["email"],
                to_name=prospect["name"],
                subject=rendered_subject or f"Hello from {config.from_name}",
                body=rendered_body,
            )
            action = "email_sent"

        elif channel == "sms":
            if not prospect["phone"]:
                detail["status"] = "skipped"
                detail["error"] = "No phone number"
                results["skipped"] += 1
                results["details"].append(detail)
                continue

            result = await send_sms(
                config=config,
                to_phone=prospect["phone"],
                message=rendered_body,
            )
            action = "sms_sent"

        elif channel == "phone":
            if not prospect["phone"]:
                detail["status"] = "skipped"
                detail["error"] = "No phone number"
                results["skipped"] += 1
                results["details"].append(detail)
                continue

            voice = step.get("voice", "Polly.Matthew")
            result = await make_call(
                config=config,
                to_phone=prospect["phone"],
                script=rendered_body,
                voice=voice,
            )
            action = "call_made"

        if result and result.get("success"):
            detail["status"] = "success"
            detail["channel_response"] = {k: v for k, v in result.items() if k != "success"}

            db.log_activity(
                prospect_id=enrollment["prospect_id"],
                channel=channel,
                action=action,
                details={
                    "cadence_id": enrollment["cadence_id"],
                    "step": step_idx,
                    "message_preview": rendered_body[:500],
                    **{k: v for k, v in result.items() if k != "success"},
                },
            )

            next_step_idx = step_idx + 1
            next_delay = steps[next_step_idx]["delay_days"] if next_step_idx < len(steps) else None
            db.advance_enrollment(enrollment["id"], next_delay)
            db.update_prospect(enrollment["prospect_id"], status="contacted")

            results["executed"] += 1
        else:
            detail["status"] = "failed"
            detail["error"] = result.get("error", "Unknown error") if result else "No result"
            results["failed"] += 1

        results["details"].append(detail)

    return results
