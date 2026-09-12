"""
OpenRouter LLM client.

All LLM calls are centralised here so that:
  - The model is read once from env and used consistently across the session.
  - Structured JSON output is requested and validated via Pydantic.
  - Errors are caught and re-raised as typed exceptions.
"""

import asyncio
import json
import logging
import os
from pathlib import Path
import time
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
    def __init__(self, message: str, retryable: bool = True, error_type: str = "LLM_ERROR"):
        super().__init__(message)
        self.message = message
        self.retryable = retryable
        self.error_type = error_type


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    response_model: Type[T],
    temperature: float = 0.2,
    max_retries_per_model: int = 1,
) -> T:
    """
    Call the configured OpenRouter model and parse the response into
    `response_model`.

    The system prompt must instruct the model to respond ONLY with valid JSON
    matching the schema. We send the JSON schema in the system prompt.
    """
    t_start = time.perf_counter()
    logger.info("[LLM] Request started")

    api_key = (settings.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")).strip()
    if not api_key:
        logger.error("[LLM] Request failed | Status: 401 | Error type: CONFIG_ERROR | Error message: OPENROUTER_API_KEY is not configured")
        raise LLMError(
            "OPENROUTER_API_KEY is not configured or is empty. "
            "Please add your OpenRouter API key to backend/.env and restart the server.",
            retryable=False,
            error_type="CONFIG_ERROR",
        )

    primary_model = os.getenv("OPENROUTER_MODEL") or settings.openrouter_model or "nvidia/nemotron-3-super-120b-a12b:free"
    base_url = settings.openrouter_base_url or "https://openrouter.ai/api/v1"
    site_url = settings.openrouter_site_url or "https://ai-trading-research.local"
    site_name = settings.openrouter_site_name or "AI Trading Research Assistant"
    timeout = getattr(settings, "llm_timeout_seconds", 60.0)

    # Models to try in order
    candidate_models = [primary_model]
    for fb in ["nvidia/nemotron-3.5-lightning:free", "nex-agi/nex-n2.5-pro:free"]:
        if fb not in candidate_models:
            candidate_models.append(fb)

    schema_json = json.dumps(response_model.model_json_schema(), indent=2)
    full_system = (
        f"{system_prompt}\n\n"
        "IMPORTANT: Respond ONLY with a single valid JSON object that strictly "
        "matches the following JSON schema. Do not include any other text, "
        "markdown fences, or explanations.\n\n"
        f"JSON Schema:\n{schema_json}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": site_url,
        "X-Title": site_name,
        "Content-Type": "application/json",
    }

    last_error_msg: str | None = None
    last_status: int = 500
    raw_content: str | None = None
    openrouter_duration: float = 0.0

    for model_idx, candidate in enumerate(candidate_models):
        logger.info("[LLM] Model: %s", candidate)

        # Controlled retry: attempt up to 1 + max_retries_per_model times per candidate
        for attempt in range(max_retries_per_model + 1):
            if attempt > 0:
                backoff_delay = 1.5 * attempt
                logger.info("[LLM] Retrying model %s (attempt %d/%d) after %.1fs backoff", candidate, attempt + 1, max_retries_per_model + 1, backoff_delay)
                await asyncio.sleep(backoff_delay)

            logger.info("[LLM] OpenRouter request sent")
            t_req = time.perf_counter()

            payload = {
                "model": candidate,
                "temperature": temperature,
                "messages": [
                    {"role": "system", "content": full_system},
                    {"role": "user", "content": user_prompt},
                ],
            }

            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    resp = await client.post(
                        f"{base_url}/chat/completions",
                        json=payload,
                        headers=headers,
                    )
                t_resp = time.perf_counter()
                openrouter_duration = t_resp - t_req
                last_status = resp.status_code

                logger.info("[LLM] Response received | Status: %d", resp.status_code)

                # Obvious non-retryable client errors
                if resp.status_code in {400, 401, 403, 422}:
                    logger.error(
                        "[LLM] Request failed | Status: %d | Error type: CLIENT_ERROR | Error message: %s",
                        resp.status_code,
                        resp.text[:300],
                    )
                    raise LLMError(
                        f"OpenRouter client error {resp.status_code}. Check API key and configuration.",
                        retryable=False,
                        error_type="CLIENT_ERROR",
                    )

                # Transient server / rate-limit errors
                if resp.status_code in {429, 500, 502, 503, 504}:
                    last_error_msg = f"HTTP {resp.status_code} from OpenRouter"
                    logger.warning(
                        "[LLM] Request failed | Status: %d | Error type: TRANSIENT_SERVER_ERROR | Error message: %s",
                        resp.status_code,
                        resp.text[:200],
                    )
                    continue

                if resp.status_code >= 400:
                    last_error_msg = f"HTTP {resp.status_code}: {resp.text[:150]}"
                    continue

                data: dict[str, Any] = resp.json()

                if "error" in data:
                    err = data["error"]
                    err_msg = err.get("message") if isinstance(err, dict) else str(err)
                    last_error_msg = err_msg
                    logger.warning(
                        "[LLM] Request failed | Status: %d | Error type: API_ERROR_PAYLOAD | Error message: %s",
                        resp.status_code,
                        err_msg,
                    )
                    continue

                if "choices" not in data or not data["choices"]:
                    last_error_msg = "No choices in model response"
                    logger.warning(
                        "[LLM] Request failed | Status: %d | Error type: EMPTY_CHOICES | Error message: %s",
                        resp.status_code,
                        last_error_msg,
                    )
                    continue

                content = data["choices"][0]["message"].get("content", "")
                if not content or not content.strip():
                    last_error_msg = "Model returned empty content"
                    logger.warning(
                        "[LLM] Request failed | Status: %d | Error type: EMPTY_CONTENT | Error message: %s",
                        resp.status_code,
                        last_error_msg,
                    )
                    continue

                raw_content = content
                break

            except httpx.TimeoutException as exc:
                openrouter_duration = time.perf_counter() - t_req
                last_error_msg = f"Connection timed out after {timeout}s"
                last_status = 504
                logger.warning(
                    "[LLM] Request failed | Status: 504 | Error type: TIMEOUT | Error message: %s",
                    last_error_msg,
                )
                continue
            except httpx.RequestError as exc:
                openrouter_duration = time.perf_counter() - t_req
                last_error_msg = f"Network connection error: {exc}"
                last_status = 503
                logger.warning(
                    "[LLM] Request failed | Status: 503 | Error type: NETWORK_ERROR | Error message: %s",
                    last_error_msg,
                )
                continue

        if raw_content is not None:
            break

    if raw_content is None:
        logger.error(
            "[LLM] Request failed | Status: %d | Error type: ALL_CANDIDATES_EXHAUSTED | Error message: %s",
            last_status,
            last_error_msg,
        )
        raise LLMError(
            f"The AI service didn't respond this time. {last_error_msg or 'Temporary provider outage.'}",
            retryable=True,
            error_type="AI_UNAVAILABLE",
        )

    # Parsing stage
    t_parse_start = time.perf_counter()
    logger.info("[LLM] Response parsing started")

    content = raw_content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        content = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error(
            "[LLM] Request failed | Status: 200 | Error type: JSON_DECODE_ERROR | Error message: %s\nContent: %s",
            exc,
            content[:400],
        )
        raise LLMError(
            "The AI returned an unexpected response format. Please try again.",
            retryable=True,
            error_type="FORMAT_ERROR",
        ) from exc
    parse_duration = time.perf_counter() - t_parse_start

    # Validation stage
    t_val_start = time.perf_counter()
    try:
        validated = response_model.model_validate(parsed)
    except ValidationError as exc:
        logger.error(
            "[LLM] Request failed | Status: 200 | Error type: SCHEMA_VALIDATION_ERROR | Error message: %s\nParsed: %s",
            exc,
            str(parsed)[:400],
        )
        raise LLMError(
            "The AI returned data that did not match the expected structure. Please try again.",
            retryable=True,
            error_type="SCHEMA_ERROR",
        ) from exc

    validation_duration = time.perf_counter() - t_val_start
    total_duration = time.perf_counter() - t_start

    logger.info("[LLM] Schema validation completed")
    logger.info("[LLM] Total duration: %.2fs", total_duration)

    logger.info(
        "[PERFORMANCE]\n"
        "OpenRouter network + generation: %.2fs\n"
        "JSON parsing: %.4fs\n"
        "Validation: %.4fs\n"
        "Total LLM duration: %.2fs",
        openrouter_duration,
        parse_duration,
        validation_duration,
        total_duration,
    )

    return validated
