"""
LLM-powered analysis service.

Responsible for:
  1. Parsing a natural-language question into structured fields.
  2. Identifying what is missing and generating clarification questions.
  3. Explaining backtest results in plain language.

All methods call llm.call_llm() which handles API, retries, and validation.
"""

from __future__ import annotations
import logging
from typing import Optional

from pydantic import BaseModel

from .llm import call_llm, LLMError
from ..schemas.analysis import (
    AnalysisResult,
    AnalyzeResponse,
    ClarificationQuestion,
    ClarificationOption,
    SourcedValue,
)
from ..schemas.explain import ExplainRequest, ExplainResponse
from ..schemas.backtest import BacktestResult
from ..schemas.experiment import ExperimentDefinition

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal Pydantic models that the LLM fills in (raw, pre-validated)
# Define sub-models first to avoid forward reference issues.
# ---------------------------------------------------------------------------

class _LLMClarificationOption(BaseModel):
    label: str
    value: str
    is_suggested: bool = False


class _LLMClarificationQuestion(BaseModel):
    field: str
    label: str
    description: str
    options: list[_LLMClarificationOption]
    allows_custom: bool = True
    custom_label: Optional[str] = None


class _LLMAnalysis(BaseModel):
    instrument: str
    instrument_source: str  # "user_provided" | "ai_inferred" | "missing"
    timeframe: str
    timeframe_source: str
    entry_condition_type: str
    entry_condition_source: str
    threshold_pct: Optional[str] = None
    threshold_source: str
    holding_period_days: Optional[str] = None
    holding_source: str
    test_period_start: Optional[str] = None
    test_period_end: Optional[str] = None
    test_period_source: str
    transaction_cost_pct: Optional[str] = None
    transaction_cost_source: str
    hypothesis: str
    clarification_questions: list[_LLMClarificationQuestion]


ANALYZE_SYSTEM_PROMPT = """You are an expert quantitative trading researcher helping users define precise, testable trading experiments.

Your task: Parse a natural-language trading question and extract structured information.

Rules:
1. NEVER invent or assume important trading parameters (like "sharp fall" threshold) — identify them as missing and ask for clarification.
2. Distinguish clearly between what the user stated, what can be confidently inferred, and what is missing.
3. For source fields, use ONLY: "user_provided", "ai_inferred", or "missing".
4. Generate 1-3 focused clarification questions for missing/ambiguous parameters. Each question must have 3-4 options with one marked as suggested.
5. For options with numeric values, put the numeric value in the "value" field (e.g. "2.0"), and a human-readable label in "label".
6. Always include a clear, falsifiable hypothesis in plain English.
7. For NIFTY questions without a specified date range, default test_period_start to "2018-01-01" and test_period_end to "2025-12-31" (source: "ai_inferred").
8. Default transaction_cost_pct to "0.10" (source: "ai_inferred") unless specified.
9. Default timeframe to "daily" for most questions (source: "ai_inferred").
10. entry_condition_type should be "price_drop" for questions about buying after falls.

The clarification_questions list should only contain questions for parameters that are genuinely ambiguous or missing. If threshold_pct is missing/ambiguous, always ask about it. If holding_period_days is missing, always ask about it.
"""


class _LLMExplanation(BaseModel):
    what_data_shows: str
    interpretation: str
    conclusions: str
    next_questions: list[str]


EXPLAIN_SYSTEM_PROMPT = """You are an expert quantitative trading researcher explaining backtesting results to a non-expert user.

Rules:
1. Base your explanation ONLY on the provided numerical results. Do not invent or assume additional data.
2. what_data_shows: Factual summary of the numbers only (no interpretation).
3. interpretation: What patterns the data suggests — clearly labelled as interpretation, not fact.
4. conclusions: Honestly assess the strength of the evidence. Mention limitations (small sample, synthetic data, no out-of-sample test, survivorship bias etc.).
5. next_questions: Provide exactly 4 specific, actionable follow-up research questions.
6. NEVER recommend buying or selling. This is research, not advice.
7. Keep language clear and accessible. Avoid jargon unless you define it.
8. If the data shows negative results, explain that clearly and honestly.
"""


async def analyze_question(question: str) -> AnalyzeResponse:
    """
    Parse a natural-language question and return structured analysis
    with clarification questions.
    """
    user_prompt = f'Trading research question: "{question}"'

    raw: _LLMAnalysis = await call_llm(
        system_prompt=ANALYZE_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=_LLMAnalysis,
        temperature=0.1,
    )

    def sourced(value: Optional[str], source: str, note: str = None) -> SourcedValue:
        return SourcedValue(value=value, source=source, note=note)  # type: ignore[arg-type]

    analysis = AnalysisResult(
        instrument=sourced(raw.instrument, raw.instrument_source),
        timeframe=sourced(raw.timeframe, raw.timeframe_source),
        entry_condition_type=sourced(raw.entry_condition_type, raw.entry_condition_source),
        threshold_pct=sourced(raw.threshold_pct, raw.threshold_source),
        holding_period_days=sourced(raw.holding_period_days, raw.holding_source),
        test_period_start=sourced(raw.test_period_start, raw.test_period_source),
        test_period_end=sourced(raw.test_period_end, raw.test_period_source),
        transaction_cost_pct=sourced(raw.transaction_cost_pct, raw.transaction_cost_source),
        hypothesis=raw.hypothesis,
        clarification_questions=[
            ClarificationQuestion(
                field=q.field,
                label=q.label,
                description=q.description,
                options=[
                    ClarificationOption(
                        label=o.label,
                        value=o.value,
                        is_suggested=o.is_suggested,
                    )
                    for o in q.options
                ],
                allows_custom=q.allows_custom,
                custom_label=q.custom_label,
            )
            for q in raw.clarification_questions
        ],
    )

    needs_clarification = len(analysis.clarification_questions) > 0

    return AnalyzeResponse(analysis=analysis, needs_clarification=needs_clarification)


async def explain_results(request: ExplainRequest) -> ExplainResponse:
    """
    Use the LLM to interpret computed backtest results.
    The LLM receives numbers; it does not calculate them.
    """
    r = request.result
    exp = r.experiment

    user_prompt = f"""
Experiment Definition:
- Instrument: {exp.instrument}
- Entry condition: NIFTY falls ≥ {exp.threshold_pct}% in one trading day
- Entry timing: Next trading day's open
- Holding period: {exp.holding_period_days} trading days
- Test period: {exp.test_period_start} to {exp.test_period_end}
- Transaction cost: {exp.transaction_cost_pct}% per leg (round-trip: {exp.transaction_cost_pct * 2}%)
- Hypothesis: {exp.hypothesis}

Data source: {r.data_label}

Computed Results (calculated by deterministic Python engine):
- Signal days (days where NIFTY fell ≥ {exp.threshold_pct}%): {r.n_signals}
- Complete trades executed: {r.n_trades}
- Profitable trades: {r.n_profitable} of {r.n_trades}
- Win rate: {r.win_rate_pct}%
- Average net return per trade: {r.avg_return_pct:+.4f}%
- Median net return per trade: {r.median_return_pct:+.4f}%
- Best single trade: {r.best_return_pct:+.4f}%
- Worst single trade: {r.worst_return_pct:+.4f}%
- Cumulative return (all trades compounded): {r.cumulative_return_pct:+.4f}%
- Average market return over same windows (no filter): {r.avg_market_return_pct:+.4f}%

Warnings: {r.warnings if r.warnings else 'None'}

Please explain these results following your instructions.
"""

    return await call_llm(
        system_prompt=EXPLAIN_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=ExplainResponse,
        temperature=0.3,
    )
