"""SendGrid email integration."""

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from config import Config


async def send_email(
    config: Config,
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
    is_html: bool = False,
) -> dict:
    """Send an email via SendGrid."""
    missing = config.validate_sendgrid()
    if missing:
        return {
            "success": False,
            "error": f"Missing SendGrid config: {', '.join(missing)}. Set these environment variables.",
        }

    try:
        message = Mail(
            from_email=(config.from_email, config.from_name),
            to_emails=to_email,
            subject=subject,
        )

        if is_html:
            message.html_content = body
        else:
            message.plain_text_content = body

        client = SendGridAPIClient(config.sendgrid_api_key)
        response = client.send(message)

        return {
            "success": response.status_code in (200, 201, 202),
            "status_code": response.status_code,
            "message_id": response.headers.get("X-Message-Id", ""),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
