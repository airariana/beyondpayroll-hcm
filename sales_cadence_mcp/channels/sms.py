"""Twilio SMS integration."""

from twilio.rest import Client

from config import Config


async def send_sms(
    config: Config,
    to_phone: str,
    message: str,
) -> dict:
    """Send an SMS via Twilio."""
    missing = config.validate_twilio()
    if missing:
        return {
            "success": False,
            "error": f"Missing Twilio config: {', '.join(missing)}. Set these environment variables.",
        }

    try:
        client = Client(config.twilio_account_sid, config.twilio_auth_token)

        msg = client.messages.create(
            to=to_phone,
            from_=config.twilio_phone_number,
            body=message,
        )

        return {
            "success": True,
            "sid": msg.sid,
            "status": msg.status,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
