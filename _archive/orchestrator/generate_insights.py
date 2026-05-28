from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Dict, Any

import anthropic

BASE_DIR = Path(__file__).resolve().parents[1]


def load_text(relative_path: str) -> str:
    return (BASE_DIR / relative_path).read_text(encoding="utf-8")


def build_prompt(context: Dict[str, Any]) -> str:
    system_prompt = load_text("system.md")
    rubric = load_text("insight_rubric.md")
    examples = load_text("examples/high_quality_insights.md")
    schema = load_text("schemas/insights_output.json")

    return f"""
SYSTEM PROMPT:
{system_prompt}

INSIGHT RUBRIC:
{rubric}

EXAMPLES:
{examples}

OUTPUT SCHEMA:
{schema}

INPUT CONTEXT:
{json.dumps(context, indent=2)}

Return only valid JSON.
""".strip()


def call_model(prompt: str) -> Dict[str, Any]:
    """Call Anthropic Claude and parse JSON response."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    raw_text = message.content[0].text.strip()

    # Strip markdown code fences if present
    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
    raw_text = re.sub(r"\s*```$", "", raw_text)

    return json.loads(raw_text)


def validate_response(response: Dict[str, Any]) -> Dict[str, Any]:
    if "insights" not in response:
        raise ValueError("Missing 'insights' key")
    if not isinstance(response["insights"], list):
        raise ValueError("'insights' must be a list")
    return response


def generate_insights(context: Dict[str, Any]) -> Dict[str, Any]:
    prompt = build_prompt(context)
    raw_response = call_model(prompt)
    validated = validate_response(raw_response)
    return validated