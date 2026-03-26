"""Configuration management for Sales Cadence MCP Server."""

import os
from dataclasses import dataclass


@dataclass
class Config:
    """Server configuration loaded from environment variables."""

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # SendGrid
    sendgrid_api_key: str = ""
    from_email: str = ""
    from_name: str = "Sales Team"

    # Database
    database_path: str = "./sales_cadence.db"

    # Twilio webhook base URL (for voice calls)
    webhook_base_url: str = ""

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        return cls(
            twilio_account_sid=os.getenv("TWILIO_ACCOUNT_SID", ""),
            twilio_auth_token=os.getenv("TWILIO_AUTH_TOKEN", ""),
            twilio_phone_number=os.getenv("TWILIO_PHONE_NUMBER", ""),
            sendgrid_api_key=os.getenv("SENDGRID_API_KEY", ""),
            from_email=os.getenv("FROM_EMAIL", ""),
            from_name=os.getenv("FROM_NAME", "Sales Team"),
            database_path=os.getenv("DATABASE_PATH", "./sales_cadence.db"),
            webhook_base_url=os.getenv("WEBHOOK_BASE_URL", ""),
        )

    def validate_twilio(self) -> list[str]:
        missing = []
        if not self.twilio_account_sid:
            missing.append("TWILIO_ACCOUNT_SID")
        if not self.twilio_auth_token:
            missing.append("TWILIO_AUTH_TOKEN")
        if not self.twilio_phone_number:
            missing.append("TWILIO_PHONE_NUMBER")
        return missing

    def validate_sendgrid(self) -> list[str]:
        missing = []
        if not self.sendgrid_api_key:
            missing.append("SENDGRID_API_KEY")
        if not self.from_email:
            missing.append("FROM_EMAIL")
        return missing
