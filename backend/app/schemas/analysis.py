from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

SourceType = Literal[
    "user_provided",
    "ai_inferred",
    "ai_suggested",
    "missing",
    "user_confirmed",
    "system_default",
]


class SourcedValue(BaseModel):
    """A single value together with where it came from."""
    value: Optional[str] = None
    source: SourceType = "missing"
    note: Optional[str] = None  # human-readable note for UI tooltips


# ---------------------------------------------------------------------------
# /api/analyze
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


class ClarificationOption(BaseModel):
    label: str          # e.g. "2% or more in one trading day"
    value: str          # e.g. "2.0"
    is_suggested: bool = False


class ClarificationQuestion(BaseModel):
    field: str          # e.g. "threshold"
    label: str          # e.g. 'Define "sharp fall"'
    description: str    # supporting text
    why_it_matters: Optional[str] = None  # Brief explanation of why this parameter matters
    options: list[ClarificationOption]
    allows_custom: bool = True
    custom_label: Optional[str] = None   # label for the custom input


class AnalysisResult(BaseModel):
    instrument: SourcedValue
    timeframe: SourcedValue
    entry_condition_type: SourcedValue   # e.g. "price_drop"
    threshold_pct: SourcedValue          # e.g. "2.0"
    holding_period_days: SourcedValue    # e.g. "5"
    test_period_start: SourcedValue      # e.g. "2018-01-01"
    test_period_end: SourcedValue        # e.g. "2025-12-31"
    transaction_cost_pct: SourcedValue   # e.g. "0.10"
    hypothesis: str
    clarification_questions: list[ClarificationQuestion]


class AnalyzeResponse(BaseModel):
    is_research_question: bool = True
    message: Optional[str] = None
    analysis: Optional[AnalysisResult] = None
    needs_clarification: bool = False
