"""Pydantic models for Sales Cadence MCP Server."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Enums ──────────────────────────────────────────────────────────────

class ProspectStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    DO_NOT_CONTACT = "do_not_contact"


class Channel(str, Enum):
    PHONE = "phone"
    EMAIL = "email"
    SMS = "sms"


class EnrollmentStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    REPLIED = "replied"
    OPTED_OUT = "opted_out"


class ActivityAction(str, Enum):
    CALL_MADE = "call_made"
    EMAIL_SENT = "email_sent"
    SMS_SENT = "sms_sent"
    REPLY_RECEIVED = "reply_received"


class ResponseFormat(str, Enum):
    MARKDOWN = "markdown"
    JSON = "json"


# ── Cadence Step Definition ───────────────────────────────────────────

class CadenceStep(BaseModel):
    """A single step in a cadence sequence."""
    model_config = ConfigDict(str_strip_whitespace=True)

    channel: Channel = Field(..., description="Outreach channel: phone, email, or sms")
    delay_days: int = Field(..., description="Days to wait after previous step before executing this step", ge=0, le=365)
    subject: Optional[str] = Field(default=None, description="Email subject line (required for email channel). Supports Jinja2 template variables.")
    template: str = Field(..., description="Message template body. Supports Jinja2 variables: {{ name }}, {{ company }}, {{ title }}, {{ custom_fields.key }}", min_length=1)


# ── Tool Input Models ─────────────────────────────────────────────────

# Prospect inputs

class ImportProspectsInput(BaseModel):
    """Import prospects from a CSV or JSON file."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    file_path: str = Field(..., description="Path to CSV or JSON file containing prospect data", min_length=1)
    deduplicate_on: Optional[str] = Field(default="email", description="Field to check for duplicates: 'email', 'phone', or 'name'")


class ListProspectsInput(BaseModel):
    """List/search prospects with filters."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    status: Optional[ProspectStatus] = Field(default=None, description="Filter by prospect status")
    company: Optional[str] = Field(default=None, description="Filter by company name (partial match)")
    search: Optional[str] = Field(default=None, description="Search across name, company, email, title")
    limit: int = Field(default=20, description="Maximum results to return", ge=1, le=100)
    offset: int = Field(default=0, description="Number of results to skip for pagination", ge=0)
    response_format: ResponseFormat = Field(default=ResponseFormat.MARKDOWN, description="Output format")


class GetProspectInput(BaseModel):
    """Get a single prospect by ID."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    prospect_id: str = Field(..., description="The prospect's unique ID", min_length=1)
    response_format: ResponseFormat = Field(default=ResponseFormat.MARKDOWN, description="Output format")


class UpdateProspectInput(BaseModel):
    """Update a prospect's information."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    prospect_id: str = Field(..., description="The prospect's unique ID", min_length=1)
    name: Optional[str] = Field(default=None, description="Updated full name")
    company: Optional[str] = Field(default=None, description="Updated company name")
    phone: Optional[str] = Field(default=None, description="Updated phone number")
    email: Optional[str] = Field(default=None, description="Updated email address")
    title: Optional[str] = Field(default=None, description="Updated job title")
    status: Optional[ProspectStatus] = Field(default=None, description="Updated status")
    custom_fields: Optional[dict[str, Any]] = Field(default=None, description="Updated custom fields (merged with existing)")


class DeleteProspectInput(BaseModel):
    """Delete a prospect."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    prospect_id: str = Field(..., description="The prospect's unique ID", min_length=1)


# Cadence inputs

class CreateCadenceInput(BaseModel):
    """Create a new outreach cadence."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(..., description="Cadence name (e.g., 'Q1 Outbound SDR')", min_length=1, max_length=200)
    steps: list[CadenceStep] = Field(..., description="Ordered list of cadence steps", min_length=1, max_length=50)


class ListCadencesInput(BaseModel):
    """List all cadences."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    active_only: bool = Field(default=False, description="Only show active cadences")
    response_format: ResponseFormat = Field(default=ResponseFormat.MARKDOWN, description="Output format")


class GetCadenceInput(BaseModel):
    """Get a single cadence by ID."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    cadence_id: str = Field(..., description="The cadence's unique ID", min_length=1)
    response_format: ResponseFormat = Field(default=ResponseFormat.MARKDOWN, description="Output format")


class UpdateCadenceInput(BaseModel):
    """Update a cadence."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    cadence_id: str = Field(..., description="The cadence's unique ID", min_length=1)
    name: Optional[str] = Field(default=None, description="Updated cadence name")
    steps: Optional[list[CadenceStep]] = Field(default=None, description="Updated list of cadence steps")
    active: Optional[bool] = Field(default=None, description="Set cadence active/inactive")


class DeleteCadenceInput(BaseModel):
    """Delete a cadence."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    cadence_id: str = Field(..., description="The cadence's unique ID", min_length=1)


# Enrollment inputs

class EnrollProspectsInput(BaseModel):
    """Enroll prospects into a cadence."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    prospect_ids: list[str] = Field(..., description="List of prospect IDs to enroll", min_length=1, max_length=500)
    cadence_id: str = Field(..., description="The cadence to enroll prospects into", min_length=1)


class GetEnrollmentsInput(BaseModel):
    """List enrollments with filters."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    cadence_id: Optional[str] = Field(default=None, description="Filter by cadence ID")
    prospect_id: Optional[str] = Field(default=None, description="Filter by prospect ID")
    status: Optional[EnrollmentStatus] = Field(default=None, description="Filter by enrollment status")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    response_format: ResponseFormat = Field(default=ResponseFormat.MARKDOWN, description="Output format")


class PauseResumeEnrollmentInput(BaseModel):
    """Pause or resume an enrollment."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    enrollment_id: str = Field(..., description="The enrollment's unique ID", min_length=1)


class ExecutePendingStepsInput(BaseModel):
    """Execute all cadence steps that are due."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    cadence_id: Optional[str] = Field(default=None, description="Only execute steps for a specific cadence")
    dry_run: bool = Field(default=False, description="If true, show what would be executed without actually sending")
    limit: int = Field(default=50, description="Max number of steps to execute in one batch", ge=1, le=200)


# Direct channel action inputs

class SendEmailInput(BaseModel):
    """Send a one-off email to a prospect."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    prospect_id: str = Field(..., description="Prospect ID to email", min_length=1)
    subject: str = Field(..., description="Email subject line", min_length=1, max_length=200)
    body: str = Field(..., description="Email body (HTML or plain text). Supports Jinja2 variables.", min_length=1)
    is_html: bool = Field(default=False, description="Whether the body is HTML")


class SendSmsInput(BaseModel):
    """Send a one-off SMS to a prospect."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    prospect_id: str = Field(..., description="Prospect ID to text", min_length=1)
    message: str = Field(..., description="SMS message body. Supports Jinja2 variables.", min_length=1, max_length=1600)


class MakeCallInput(BaseModel):
    """Initiate a phone call to a prospect."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    prospect_id: str = Field(..., description="Prospect ID to call", min_length=1)
    script: str = Field(..., description="Call script/pitch to be spoken. Supports Jinja2 variables.", min_length=1)
    voice: str = Field(default="Polly.Matthew", description="Twilio voice to use (e.g., 'Polly.Matthew', 'Polly.Joanna')")


# Reporting inputs

class GetActivityLogInput(BaseModel):
    """Get activity log entries."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    prospect_id: Optional[str] = Field(default=None, description="Filter by prospect ID")
    channel: Optional[Channel] = Field(default=None, description="Filter by channel")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    response_format: ResponseFormat = Field(default=ResponseFormat.MARKDOWN, description="Output format")


class GetCadenceStatsInput(BaseModel):
    """Get statistics for a cadence."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    cadence_id: str = Field(..., description="The cadence's unique ID", min_length=1)
    response_format: ResponseFormat = Field(default=ResponseFormat.MARKDOWN, description="Output format")
