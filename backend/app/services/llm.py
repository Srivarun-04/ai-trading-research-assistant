"""
OpenRouter LLM client.

All LLM calls are centralised here so that:
  - The model is read once from env and used consistently across the session.
  - Structured JSON output is requested and validated via Pydantic.
  - Errors are caught and re-raised as typed exceptions.
"""

from __future__ import annotations
import json
import logging
import os
from pathlib import Path
from typing import Any, Type, TypeVar

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError

from ..config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Exported constants for compatibility
OPENROUTER_BASE = settings.openrouter_base_url
OPENROUTER_API_KEY = settings.openrouter_api_key
OPENROUTER_MODEL = settings.openrouter_model
SITE_NAME = settings.openrouter_site_name


class LLMError(Exception):
    """Raised when the LLM call fails or returns invalid data."""


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    response_model: Type[T],
    temperature: float = 0.2,
) -> T:
    """
    Call the configured OpenRouter model and parse the response into
    `response_model`.

    The system prompt must instruct the model to respond ONLY with valid JSON
    matching the schema. We send the JSON schema in the system prompt.
    """
    api_key = (settings.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")).strip()
    if not api_key:
        raise LLMError(
            "OPENROUTER_API_KEY is not configured or is empty. "
            "Please add your OpenRouter API key to backend/.env and restart the server."
        )

    model = settings.openrouter_model or os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
    base_url = settings.openrouter_base_url or "https://openrouter.ai/api/v1"
    site_url = settings.openrouter_site_url or "https://ai-trading-research.local"
    site_name = settings.openrouter_site_name or "AI Trading Research Assistant"
    timeout = getattr(settings, "llm_timeout_seconds", 60.0)

    schema_json = json.dumps(response_model.model_json_schema(), indent=2)
    full_system = (
        f"{system_prompt}\n\n"
        "IMPORTANT: Respond ONLY with a single valid JSON object that strictly "
        "matches the following JSON schema. Do not include any other text, "
        "markdown fences, or explanations.\n\n"
        f"JSON Schema:\n{schema_json}"
    )

    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": full_system},
            {"role": "user", "content": user_prompt},
        ],
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": site_url,
        "X-Title": site_name,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("OpenRouter HTTP error %s: %s", exc.response.status_code, exc.response.text)
        raise LLMError(
            f"OpenRouter returned HTTP {exc.response.status_code}. "
            "Check your API key and model name."
        ) from exc
    except httpx.RequestError as exc:
        logger.error("OpenRouter request error: %s", exc)
        raise LLMError(f"Could not reach OpenRouter: {exc}") from exc

    data: dict[str, Any] = resp.json()

    if "error" in data:
        err = data["error"]
        err_msg = err.get("message") if isinstance(err, dict) else str(err)
        raise LLMError(f"OpenRouter API error: {err_msg}")

    if "choices" not in data or not data["choices"]:
        raise LLMError("OpenRouter returned an invalid response (missing choices).")

    raw_content: str = data["choices"][0]["message"]["content"]

    # Strip markdown fences if the model ignored instructions
    content = raw_content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        content = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error("LLM returned non-JSON: %s", content[:500])
        raise LLMError(
            "The AI returned an unexpected format. Please try again."
        ) from exc

    try:
        return response_model.model_validate(parsed)
    except ValidationError as exc:
        logger.error("LLM response failed schema validation: %s\nRaw: %s", exc, content[:500])
        raise LLMError(
            "The AI returned data that did not match the expected structure. "
            "Please try again."
        ) from exc
