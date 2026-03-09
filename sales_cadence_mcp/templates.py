"""Jinja2 template rendering for message personalization."""

from typing import Any

from jinja2 import BaseLoader, Environment, TemplateSyntaxError, Undefined, UndefinedError


class SilentUndefined(Undefined):
    """Return empty string for undefined variables instead of raising."""
    def __str__(self):
        return ""
    def __iter__(self):
        return iter([])
    def __bool__(self):
        return False


_env = Environment(loader=BaseLoader(), undefined=SilentUndefined)


def render_template(template_str: str, prospect: dict[str, Any]) -> str:
    """Render a Jinja2 template string with prospect data.

    Available variables:
        {{ name }}, {{ company }}, {{ title }}, {{ email }}, {{ phone }}
        {{ custom_fields.key }} for any custom field
    """
    try:
        tpl = _env.from_string(template_str)
        context = {
            "name": prospect.get("name", ""),
            "company": prospect.get("company", ""),
            "title": prospect.get("title", ""),
            "email": prospect.get("email", ""),
            "phone": prospect.get("phone", ""),
            "custom_fields": prospect.get("custom_fields", {}),
        }
        return tpl.render(**context)
    except (TemplateSyntaxError, UndefinedError) as e:
        return f"[Template error: {e}] {template_str}"
