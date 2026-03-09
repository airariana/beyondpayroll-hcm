"""Twilio Voice integration with TwiML-based AI conversation."""

from twilio.rest import Client
from twilio.twiml.voice_response import Gather, VoiceResponse

from config import Config


def build_twiml_script(script: str, voice: str = "Polly.Matthew") -> str:
    """Build a TwiML response that speaks a script and gathers a key press."""
    response = VoiceResponse()

    gather = Gather(num_digits=1, timeout=10, action="/call-response")
    gather.say(script, voice=voice)
    gather.say(
        "Press 1 if you'd like to learn more. "
        "Press 2 if you're not interested. "
        "Press 9 to be removed from our list.",
        voice=voice,
    )
    response.append(gather)

    response.say("Thank you for your time. Have a great day!", voice=voice)
    response.hangup()

    return str(response)


async def make_call(
    config: Config,
    to_phone: str,
    script: str,
    voice: str = "Polly.Matthew",
) -> dict:
    """Initiate an outbound phone call via Twilio."""
    missing = config.validate_twilio()
    if missing:
        return {
            "success": False,
            "error": f"Missing Twilio config: {', '.join(missing)}. Set these environment variables.",
        }

    twiml = build_twiml_script(script, voice)

    try:
        client = Client(config.twilio_account_sid, config.twilio_auth_token)

        call_kwargs = {
            "to": to_phone,
            "from_": config.twilio_phone_number,
        }

        if config.webhook_base_url:
            call_kwargs["url"] = f"{config.webhook_base_url}/twiml"
        else:
            call_kwargs["twiml"] = twiml

        call = client.calls.create(**call_kwargs)

        return {
            "success": True,
            "sid": call.sid,
            "status": call.status,
            "twiml_preview": twiml[:500],
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
