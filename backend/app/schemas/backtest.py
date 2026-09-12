from __future__ import annotations
from pydantic import BaseModel
from .experiment import ExperimentDefinition


class BacktestRequest(BaseModel):
    experiment: ExperimentDefinition


class TradeRecord(BaseModel):
    signal_date: str
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    raw_return_pct: float
    net_return_pct: float


class BacktestResult(BaseModel):
    experiment: ExperimentDefinition

    # Aggregate stats
    n_signals: int
    n_trades: int           # trades where entry+exit data existed
    n_profitable: int
    win_rate_pct: float
    avg_return_pct: float
    median_return_pct: float
    best_return_pct: float
    worst_return_pct: float
    cumulative_return_pct: float
    avg_market_return_pct: float    # benchmark: buy-and-hold avg over same windows

    # Individual trades (for transparency)
    trades: list[TradeRecord]

    # Metadata
    data_start: str
    data_end: str
    data_label: str         # e.g. "Sample data (synthetic)" or "NIFTY 50 historical"
    warnings: list[str]
