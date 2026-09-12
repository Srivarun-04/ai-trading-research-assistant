from __future__ import annotations
from pydantic import BaseModel
from .backtest import BacktestResult


class ExplainRequest(BaseModel):
    result: BacktestResult


class ExplainResponse(BaseModel):
    what_data_shows: str        # Plain-language factual summary of numbers
    interpretation: str         # LLM interpretation (clearly labelled)
    conclusions: str            # Strength of evidence, limitations
    next_questions: list[str]   # Follow-up research suggestions
