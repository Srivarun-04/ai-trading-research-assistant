"""
Deterministic backtesting engine.

ALL numerical calculations happen here.
The LLM is NEVER called from this module.

Algorithm:
  1. Load NIFTY daily data for the requested period.
  2. Find signal days: days where close_pct_change <= -threshold_pct.
  3. For each signal, entry = next trading day's open.
  4. Exit = open price N trading days after entry (N = holding_period_days).
  5. raw_return = (exit - entry) / entry
  6. net_return = raw_return - 2 * transaction_cost_pct / 100  (round-trip)
  7. Aggregate statistics over all valid trades.
"""

from __future__ import annotations
import logging
from datetime import datetime

import numpy as np
import pandas as pd

from ..schemas.experiment import ExperimentDefinition
from ..schemas.backtest import BacktestResult, TradeRecord
from ..data.loader import load_nifty

logger = logging.getLogger(__name__)


class BacktestError(Exception):
    """Raised when the backtest cannot be completed."""


def run_backtest(experiment: ExperimentDefinition) -> BacktestResult:
    """
    Run a deterministic backtest for the given experiment.
    Returns a BacktestResult with all statistics pre-calculated.
    """
    warnings: list[str] = []

    # ------------------------------------------------------------------
    # 1. Validate dates
    # ------------------------------------------------------------------
    try:
        start_dt = datetime.strptime(experiment.test_period_start, "%Y-%m-%d")
        end_dt = datetime.strptime(experiment.test_period_end, "%Y-%m-%d")
    except ValueError as exc:
        raise BacktestError(f"Invalid date format: {exc}") from exc

    if start_dt >= end_dt:
        raise BacktestError("test_period_start must be before test_period_end.")

    # ------------------------------------------------------------------
    # 2. Load data
    # ------------------------------------------------------------------
    df, data_label = load_nifty(experiment.test_period_start, experiment.test_period_end)

    if df.empty:
        raise BacktestError(
            "No price data available for the requested period. "
            "Try a different date range."
        )

    if len(df) < 30:
        raise BacktestError(
            f"Only {len(df)} trading days found — need at least 30 for a meaningful test."
        )

    # Convert to float to be safe
    df["open"] = pd.to_numeric(df["open"], errors="coerce")
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    df = df.dropna(subset=["open", "close"]).reset_index(drop=True)

    # ------------------------------------------------------------------
    # 3. Find signal dates
    # ------------------------------------------------------------------
    df["pct_change"] = df["close"].pct_change() * 100  # in percent

    # Signal: close fell by >= threshold_pct on this day
    signal_mask = df["pct_change"] <= -experiment.threshold_pct
    signal_indices = df.index[signal_mask].tolist()

    n_signals = len(signal_indices)

    if n_signals == 0:
        raise BacktestError(
            f"No signal days found where NIFTY fell ≥ {experiment.threshold_pct}% "
            f"in the period {experiment.test_period_start} – {experiment.test_period_end}. "
            "Try lowering the threshold or widening the date range."
        )

    if n_signals < 5:
        warnings.append(
            f"Only {n_signals} signal days found. "
            "Statistical conclusions from so few observations are very weak."
        )

    # ------------------------------------------------------------------
    # 4. Calculate trades
    # ------------------------------------------------------------------
    hp = experiment.holding_period_days
    tc = experiment.transaction_cost_pct / 100  # per leg

    trades: list[TradeRecord] = []
    market_returns: list[float] = []

    for sig_idx in signal_indices:
        entry_idx = sig_idx + 1
        exit_idx = entry_idx + hp

        if entry_idx >= len(df) or exit_idx >= len(df):
            # Not enough data after this signal
            continue

        entry_price = df.loc[entry_idx, "open"]
        exit_price = df.loc[exit_idx, "open"]

        if entry_price <= 0 or exit_price <= 0:
            continue

        raw_return = (exit_price - entry_price) / entry_price
        net_return = raw_return - tc - tc  # buy and sell

        # Benchmark: market return over the same window (regardless of signal)
        market_returns.append(raw_return)

        trades.append(
            TradeRecord(
                signal_date=df.loc[sig_idx, "date"],
                entry_date=df.loc[entry_idx, "date"],
                exit_date=df.loc[exit_idx, "date"],
                entry_price=round(float(entry_price), 2),
                exit_price=round(float(exit_price), 2),
                raw_return_pct=round(raw_return * 100, 4),
                net_return_pct=round(net_return * 100, 4),
            )
        )

    if not trades:
        raise BacktestError(
            "No complete trades could be executed — the signals all occurred too close "
            "to the end of the data period to allow a full holding period."
        )

    # ------------------------------------------------------------------
    # 5. Aggregate statistics
    # ------------------------------------------------------------------
    returns = np.array([t.net_return_pct for t in trades])
    n_trades = len(trades)
    n_profitable = int(np.sum(returns > 0))
    win_rate = (n_profitable / n_trades) * 100

    # Cumulative return: compound each trade (approximation for non-overlapping trades)
    cumulative = float(np.prod(1 + returns / 100) - 1) * 100

    avg_mkt = float(np.mean(market_returns) * 100) if market_returns else 0.0

    if n_trades < 10:
        warnings.append(
            f"Only {n_trades} complete trades. Treat statistics as indicative only."
        )

    return BacktestResult(
        experiment=experiment,
        n_signals=n_signals,
        n_trades=n_trades,
        n_profitable=n_profitable,
        win_rate_pct=round(win_rate, 1),
        avg_return_pct=round(float(np.mean(returns)), 4),
        median_return_pct=round(float(np.median(returns)), 4),
        best_return_pct=round(float(np.max(returns)), 4),
        worst_return_pct=round(float(np.min(returns)), 4),
        cumulative_return_pct=round(cumulative, 4),
        avg_market_return_pct=round(avg_mkt, 4),
        trades=trades,
        data_start=df["date"].iloc[0],
        data_end=df["date"].iloc[-1],
        data_label=data_label,
        warnings=warnings,
    )
