"""
Data loader for NIFTY price data.

Strategy:
1. Try to load real data via yfinance (^NSEI).
2. If unavailable (no internet, yfinance not installed), fall back to the
   bundled synthetic CSV.

The data_label returned tells the caller (and ultimately the UI) exactly
which data source was used, so the user always knows what they are looking at.
"""

from __future__ import annotations
import logging
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

SAMPLE_CSV = Path(__file__).parent / "nifty_sample.csv"
REAL_TICKER = "^NSEI"


def load_nifty(start: str = "2018-01-01", end: str = "2025-12-31") -> tuple[pd.DataFrame, str]:
    """
    Returns (DataFrame, data_label).

    DataFrame columns: date (str YYYY-MM-DD), open, high, low, close  — all float.
    data_label: human-readable string describing the data source.
    """
    df, label = _try_yfinance(start, end)
    if df is None:
        df, label = _load_sample_csv(start, end)
    return df, label


def _try_yfinance(start: str, end: str) -> tuple[pd.DataFrame | None, str]:
    try:
        import yfinance as yf  # optional dependency
        ticker = yf.Ticker(REAL_TICKER)
        raw = ticker.history(start=start, end=end, interval="1d", auto_adjust=True)
        if raw.empty:
            logger.warning("yfinance returned empty DataFrame for %s", REAL_TICKER)
            return None, ""
        raw = raw.reset_index()
        raw.columns = [c.lower() for c in raw.columns]
        # yfinance column may be 'date' or 'datetime'
        date_col = "date" if "date" in raw.columns else "datetime"
        raw = raw.rename(columns={date_col: "date"})
        raw["date"] = pd.to_datetime(raw["date"]).dt.strftime("%Y-%m-%d")
        df = raw[["date", "open", "high", "low", "close"]].copy()
        df = df.dropna()
        label = f"NIFTY 50 historical data via yfinance ({start} – {end})"
        logger.info("Loaded %d rows from yfinance", len(df))
        return df, label
    except Exception as exc:
        logger.info("yfinance unavailable (%s), falling back to sample data", exc)
        return None, ""


def _load_sample_csv(start: str, end: str) -> tuple[pd.DataFrame, str]:
    """Load (and lazily generate) the bundled synthetic CSV."""
    if not SAMPLE_CSV.exists():
        logger.info("Sample CSV not found, generating...")
        from .generate_sample import generate_nifty_sample
        df_full = generate_nifty_sample()
        df_full.to_csv(SAMPLE_CSV, index=False)

    df = pd.read_csv(SAMPLE_CSV, dtype={"date": str})
    df = df[(df["date"] >= start) & (df["date"] <= end)].copy()
    df = df.sort_values("date").reset_index(drop=True)
    label = "⚠ Sample data (synthetic, for demonstration only — not real market data)"
    logger.info("Loaded %d rows from sample CSV", len(df))
    return df, label
