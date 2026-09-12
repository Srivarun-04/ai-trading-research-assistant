"""
Centralized configuration module.

All environment variables are read here once at import time.
No other module should call os.getenv() directly.

Usage:
    from app.config import settings

    settings.openrouter_api_key
    settings.openrouter_model
"""

from __future__ import annotations
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings

# Load .env from the backend root (two levels up) or workspace root
_BACKEND_ENV = Path(__file__).parent.parent / ".env"
_ROOT_ENV = Path(__file__).parent.parent.parent / ".env"

if _BACKEND_ENV.exists():
    load_dotenv(_BACKEND_ENV)
if _ROOT_ENV.exists():
    load_dotenv(_ROOT_ENV)
load_dotenv()

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All fields have defaults so the app starts even without a .env file,
    but LLM calls will fail until OPENROUTER_API_KEY is set.
    """

    # ------------------------------------------------------------------
    # OpenRouter / LLM
    # ------------------------------------------------------------------
    openrouter_api_key: str = ""
    openrouter_model: str = "nvidia/nemotron-3-super-120b-a12b:free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_site_name: str = "AI Trading Research Assistant"
    openrouter_site_url: str = "https://ai-trading-research.local"

    # ------------------------------------------------------------------
    # LLM behaviour
    # ------------------------------------------------------------------
    llm_timeout_seconds: float = 90.0   # Nemotron is large — allow generous timeout
    llm_max_retries: int = 1            # Retry once on validation failure
    llm_analyze_temperature: float = 0.1
    llm_explain_temperature: float = 0.3

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        # Allow extra fields in case the user adds custom env vars
        extra = "ignore"

    @field_validator("openrouter_api_key")
    @classmethod
    def warn_if_missing(cls, v: str) -> str:
        if not v:
            logger.warning(
                "OPENROUTER_API_KEY is not set. "
                "All LLM calls will fail until it is configured in backend/.env"
            )
        return v

    @property
    def has_api_key(self) -> bool:
        return bool(self.openrouter_api_key)


# Single shared instance — import this everywhere
settings = Settings()

# Log the active model at startup (never log the key itself)
logger.info("LLM model configured: %s", settings.openrouter_model)
