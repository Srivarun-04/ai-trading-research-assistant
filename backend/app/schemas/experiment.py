from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


class ExperimentDefinition(BaseModel):
    """
    A fully-specified, validated experiment ready for backtesting.
    All fields are required – no nulls allowed past this point.
    """
    instrument: str = Field(..., description="e.g. 'NIFTY 50'")
    timeframe: str = Field(default="daily")
    entry_condition_type: str = Field(default="price_drop")
    threshold_pct: float = Field(..., gt=0, le=20, description="Drop % to trigger entry, e.g. 2.0")
    holding_period_days: int = Field(..., gt=0, le=252, description="Trading days to hold")
    test_period_start: str = Field(..., description="ISO date e.g. '2018-01-01'")
    test_period_end: str = Field(..., description="ISO date e.g. '2025-12-31'")
    transaction_cost_pct: float = Field(default=0.10, ge=0, le=5)
    hypothesis: str

    # Track provenance so the UI can display badges
    field_sources: dict[str, str] = Field(
        default_factory=dict,
        description="Maps field name -> source type for UI badges"
    )


class BuildExperimentRequest(BaseModel):
    """Request to build a fully-specified experiment from confirmed params."""
    original_question: str
    confirmed_params: dict[str, str]  # field -> confirmed string value
    field_sources: dict[str, str]     # field -> source label


class BuildExperimentResponse(BaseModel):
    experiment: ExperimentDefinition
