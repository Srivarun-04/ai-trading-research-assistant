"""
Experiment builder service.

Takes confirmed parameters from the user (post-clarification) and
constructs a fully-validated ExperimentDefinition.
"""

from __future__ import annotations
import logging
from datetime import datetime

from ..schemas.experiment import ExperimentDefinition, BuildExperimentRequest, BuildExperimentResponse

logger = logging.getLogger(__name__)


def build_experiment(request: BuildExperimentRequest) -> BuildExperimentResponse:
    """
    Merge confirmed_params into a validated ExperimentDefinition.
    Raises ValueError if any required parameter is missing or invalid.
    """
    p = request.confirmed_params
    sources = request.field_sources

    errors: list[str] = []

    def get(field: str, required: bool = True) -> str | None:
        val = p.get(field)
        if required and (val is None or val.strip() == ""):
            errors.append(f"'{field}' is required but was not provided.")
        return val

    instrument = get("instrument") or "NIFTY 50"
    timeframe = p.get("timeframe", "daily")
    entry_condition_type = p.get("entry_condition_type", "price_drop")
    hypothesis = p.get("hypothesis", "")

    # Numeric fields
    threshold_str = get("threshold_pct")
    holding_str = get("holding_period_days")
    tc_str = p.get("transaction_cost_pct", "0.10")
    start_str = p.get("test_period_start", "2018-01-01")
    end_str = p.get("test_period_end", "2025-12-31")

    if errors:
        raise ValueError("; ".join(errors))

    # Parse numeric values
    try:
        threshold_pct = float(threshold_str)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise ValueError(f"threshold_pct must be a number, got: {threshold_str!r}")

    try:
        holding_period_days = int(holding_str)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise ValueError(f"holding_period_days must be an integer, got: {holding_str!r}")

    try:
        transaction_cost_pct = float(tc_str)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        transaction_cost_pct = 0.10

    # Validate dates
    try:
        datetime.strptime(start_str, "%Y-%m-%d")  # type: ignore[arg-type]
        datetime.strptime(end_str, "%Y-%m-%d")  # type: ignore[arg-type]
    except ValueError:
        raise ValueError(f"Invalid date format. Expected YYYY-MM-DD, got: {start_str!r}, {end_str!r}")

    experiment = ExperimentDefinition(
        instrument=instrument,
        timeframe=timeframe,
        entry_condition_type=entry_condition_type,
        threshold_pct=threshold_pct,
        holding_period_days=holding_period_days,
        test_period_start=start_str,  # type: ignore[arg-type]
        test_period_end=end_str,  # type: ignore[arg-type]
        transaction_cost_pct=transaction_cost_pct,
        hypothesis=hypothesis or _default_hypothesis(instrument, threshold_pct, holding_period_days),
        field_sources=sources,
    )

    return BuildExperimentResponse(experiment=experiment)


def _default_hypothesis(instrument: str, threshold: float, holding_days: int) -> str:
    return (
        f"Buying {instrument} after a one-day decline of ≥ {threshold}% "
        f"produces positive returns over the following {holding_days} trading days."
    )
