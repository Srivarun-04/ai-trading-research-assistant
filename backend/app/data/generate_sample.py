"""
Generates a synthetic-but-statistically-realistic NIFTY 50 daily dataset.

Properties match historical NIFTY characteristics (2018-2025):
  - Mean daily log-return:  ~0.04%
  - Daily volatility:       ~1.1%
  - Starting value:         ~10,000 (NIFTY approximate Jan 2018 level)

This data is clearly labelled as SYNTHETIC throughout the codebase.
It is used to demonstrate the backtesting engine, NOT for investment decisions.
"""

import numpy as np
import pandas as pd
from pathlib import Path


def generate_nifty_sample(
    start: str = "2018-01-01",
    end: str = "2025-12-31",
    start_price: float = 10_200.0,
    daily_mean: float = 0.0004,
    daily_vol: float = 0.011,
    seed: int = 42,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # Generate business days (Mon-Fri, approximate trading calendar)
    dates = pd.bdate_range(start=start, end=end)

    n = len(dates)
    log_returns = rng.normal(loc=daily_mean, scale=daily_vol, size=n)

    # Intraday variation: open slightly off previous close, high/low around
    closes = start_price * np.exp(np.cumsum(log_returns))
    opens = np.concatenate([[start_price], closes[:-1]]) * np.exp(
        rng.normal(0, 0.003, n)
    )

    daily_range = np.abs(rng.normal(0, daily_vol * 0.8, n))
    highs = np.maximum(opens, closes) * (1 + daily_range)
    lows = np.minimum(opens, closes) * (1 - daily_range)

    df = pd.DataFrame(
        {
            "date": dates,
            "open": np.round(opens, 2),
            "high": np.round(highs, 2),
            "low": np.round(lows, 2),
            "close": np.round(closes, 2),
        }
    )
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    return df


if __name__ == "__main__":
    out = Path(__file__).parent / "nifty_sample.csv"
    df = generate_nifty_sample()
    df.to_csv(out, index=False)
    print(f"Generated {len(df)} rows -> {out}")
    print(df.head())
    print(df.tail())
