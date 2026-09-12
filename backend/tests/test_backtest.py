"""
Unit tests for the deterministic backtesting engine.

These tests verify that:
  - Signal detection is correct.
  - Return calculations are correct.
  - Transaction costs are applied properly.
  - Edge cases (no signals, insufficient data) are handled gracefully.
"""

import sys
from pathlib import Path

# Ensure backend/app is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
import pytest

from app.schemas.experiment import ExperimentDefinition
from app.services.backtest import run_backtest, BacktestError


def _make_experiment(**overrides) -> ExperimentDefinition:
    defaults = dict(
        instrument="NIFTY 50",
        timeframe="daily",
        entry_condition_type="price_drop",
        threshold_pct=2.0,
        holding_period_days=5,
        test_period_start="2018-01-01",
        test_period_end="2025-12-31",
        transaction_cost_pct=0.10,
        hypothesis="Test hypothesis",
    )
    defaults.update(overrides)
    return ExperimentDefinition(**defaults)


def _patch_loader(monkeypatch, df: pd.DataFrame):
    """Patch the data loader to return a controlled DataFrame."""
    def mock_load_nifty(start, end):
        filtered = df[(df["date"] >= start) & (df["date"] <= end)].copy()
        return filtered, "Mock data (unit test)"

    monkeypatch.setattr("app.services.backtest.load_nifty", mock_load_nifty)


def _make_price_df(prices: list[float], start: str = "2020-01-01") -> pd.DataFrame:
    """Create a minimal price DataFrame from a list of close prices."""
    dates = pd.bdate_range(start=start, periods=len(prices))
    return pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "open": prices,
        "high": [p * 1.005 for p in prices],
        "low": [p * 0.995 for p in prices],
        "close": prices,
    })


# ---------------------------------------------------------------------------
# Signal detection
# ---------------------------------------------------------------------------

class TestSignalDetection:

    def test_detects_exact_threshold(self, monkeypatch):
        """A day where close falls exactly threshold_pct should trigger a signal."""
        # Day 0: 10000, Day 1: 9800 (-2.0%), then 38 flat days to satisfy the 30-row guard
        prices = [10000.0, 9800.0] + [9800.0] * 38
        df = _make_price_df(prices)
        _patch_loader(monkeypatch, df)

        exp = _make_experiment(threshold_pct=2.0, holding_period_days=3)
        result = run_backtest(exp)

        assert result.n_signals >= 1

    def test_no_signal_when_drop_below_threshold(self, monkeypatch):
        """A 1.9% drop should NOT trigger a 2.0% threshold signal."""
        # Day 1: -1.9% — should not trigger a 2% threshold
        prices = [10000.0, 10000 * (1 - 0.019)] + [9810.0] * 38
        df = _make_price_df(prices)
        _patch_loader(monkeypatch, df)

        exp = _make_experiment(threshold_pct=2.0, holding_period_days=3)
        with pytest.raises(BacktestError, match="No signal days found"):
            run_backtest(exp)

    def test_multiple_signals(self, monkeypatch):
        """Multiple qualifying drops should each generate a signal."""
        # Big drops on days 1 and 11, padded to 40+ rows
        prices = (
            [10000.0, 9700.0]   # -3% (signal)
            + [9700.0] * 8
            + [9700.0, 9400.0]  # ~-3.1% (signal)
            + [9400.0] * 28
        )
        df = _make_price_df(prices)
        _patch_loader(monkeypatch, df)

        exp = _make_experiment(threshold_pct=2.0, holding_period_days=3)
        result = run_backtest(exp)

        assert result.n_signals >= 2


# ---------------------------------------------------------------------------
# Return calculations
# ---------------------------------------------------------------------------

class TestReturnCalculation:

    def test_positive_return_calculation(self, monkeypatch):
        """Verify net return calculation with known numbers.

        Layout: prices[i] is both open and close of day i.
          Signal on day 1 (close falls -3% from day 0)
          Entry = day 2 open = 9700
          Exit  = open at day (entry_idx + holding_period) = open[2+5] = open[7] = 9900
          raw_return = (9900 - 9700) / 9700 * 100 = 2.0619...%
          net_return = raw_return - 0.10 - 0.10 = 1.8619...%
        """
        prices = [10000.0, 9700.0, 9700.0, 9750.0, 9800.0, 9850.0, 9894.0, 9900.0] + [9900.0] * 32
        df = _make_price_df(prices)
        _patch_loader(monkeypatch, df)

        exp = _make_experiment(threshold_pct=2.0, holding_period_days=5, transaction_cost_pct=0.10)
        result = run_backtest(exp)

        assert result.n_trades >= 1
        trade = result.trades[0]
        # entry_idx=2 (open=9700), exit_idx=7 (open=9900)
        expected_raw = (9900.0 - 9700.0) / 9700.0 * 100
        expected_net = expected_raw - 0.10 - 0.10  # buy + sell legs
        assert abs(trade.net_return_pct - expected_net) < 0.01

    def test_win_rate_calculation(self, monkeypatch):
        """Win rate should equal n_profitable / n_trades * 100 (within rounding)."""
        # Use the real engine with synthetic data — just check the math holds
        from app.data.generate_sample import generate_nifty_sample
        df = generate_nifty_sample(seed=123)
        _patch_loader(monkeypatch, df)

        exp = _make_experiment(threshold_pct=1.5, holding_period_days=5)
        result = run_backtest(exp)

        # win_rate_pct is rounded to 1 decimal, so tolerance must be >= 0.05
        expected_wr = (result.n_profitable / result.n_trades) * 100
        assert abs(result.win_rate_pct - expected_wr) < 0.1

    def test_zero_transaction_cost(self, monkeypatch):
        """With zero transaction cost, raw_return should equal net_return."""
        # Pad to 40 rows to pass the 30-row guard
        prices = [10000.0, 9700.0] + [9700.0] * 3 + [9800.0] + [9800.0] * 34
        df = _make_price_df(prices)
        _patch_loader(monkeypatch, df)

        exp = _make_experiment(threshold_pct=2.0, holding_period_days=4, transaction_cost_pct=0.0)
        result = run_backtest(exp)

        for trade in result.trades:
            assert abs(trade.raw_return_pct - trade.net_return_pct) < 0.0001


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:

    def test_insufficient_data_raises(self, monkeypatch):
        """Very few rows should raise BacktestError."""
        prices = [10000.0] * 10
        df = _make_price_df(prices)
        _patch_loader(monkeypatch, df)

        exp = _make_experiment(threshold_pct=2.0, holding_period_days=5)
        with pytest.raises(BacktestError):
            run_backtest(exp)

    def test_invalid_dates_raise(self):
        """start >= end should raise BacktestError."""
        exp = _make_experiment(
            test_period_start="2025-01-01",
            test_period_end="2020-01-01",
        )
        with pytest.raises(BacktestError, match="before"):
            run_backtest(exp)

    def test_stats_consistency(self, monkeypatch):
        """avg, median, best, worst should be consistent with trades list."""
        from app.data.generate_sample import generate_nifty_sample
        df = generate_nifty_sample(seed=42)
        _patch_loader(monkeypatch, df)

        exp = _make_experiment(threshold_pct=1.0, holding_period_days=5)
        result = run_backtest(exp)

        returns = [t.net_return_pct for t in result.trades]
        import statistics
        assert abs(result.avg_return_pct - statistics.mean(returns)) < 0.001
        assert abs(result.best_return_pct - max(returns)) < 0.001
        assert abs(result.worst_return_pct - min(returns)) < 0.001
