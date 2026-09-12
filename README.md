# AI Trading Research Assistant

A full-stack research prototype that guides users through a structured trading experiment workflow:

**ASK → CLARIFY → DEFINE → TEST → LEARN**

---

## Problem Being Solved

A researcher types: *"Does buying NIFTY after a sharp fall work?"*

This question is too vague to test directly. The system:
1. Parses the question with an LLM to extract what is known and what is ambiguous.
2. Asks the user to confirm the missing parameters (threshold, holding period).
3. Builds a precise experiment definition the user has explicitly approved.
4. Runs a deterministic Python backtesting engine — no LLM arithmetic.
5. Uses the LLM to explain the computed results in plain language.

The key principle: **AI proposes → User reviews → User confirms → Code tests → AI explains**

---

## User Flow

| Step | Screen | What happens |
|------|--------|--------------|
| ASK | `/` | User enters a free-text research question |
| CLARIFY | `/analyze` | LLM extracts structure; user answers clarification questions |
| DEFINE | `/experiment` | User reviews and can edit the full experiment definition |
| TEST | (background) | Python calculates all statistics deterministically |
| LEARN | `/results` | Stats shown immediately; LLM explains results asynchronously |

---

## Architecture

```
frontend/          → Next.js 14 (App Router) + TypeScript + Tailwind CSS
backend/           → FastAPI (Python 3.11+) + Pydantic v2
backend/data/      → NIFTY 50 price data (yfinance or synthetic CSV)
```

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/analyze` | NL question → structured analysis + clarification questions |
| POST | `/api/experiment` | Confirmed params → validated ExperimentDefinition |
| POST | `/api/backtest` | ExperimentDefinition → deterministic BacktestResult |
| POST | `/api/explain` | BacktestResult → LLM explanation in plain language |

---

## Technology Choices

| Layer | Tool | Why |
|-------|------|-----|
| Frontend | Next.js 14 | App Router, TypeScript, file-based routing |
| Styling | Tailwind CSS | Rapid prototyping, consistent design system |
| API Proxy | Next.js rewrites | Keeps API key off the browser |
| Backend | FastAPI | Async, Pydantic-native, auto-generated docs |
| AI | OpenRouter | Model-agnostic, configurable, single API |
| Data/Calc | pandas + numpy | Industry-standard time-series arithmetic |
| Validation | Pydantic v2 | Strict schema enforcement end-to-end |

---

## How the LLM is Used

The LLM is used in **exactly two places**:

### 1. `/api/analyze` — Question parsing
Converts a free-text question into a structured JSON object. Identifies which fields are:
- **user_provided** — explicit in the question
- **ai_inferred** — deducible with high confidence
- **missing** — genuinely ambiguous (generates a clarification question)

The LLM **never** invents important parameters silently. It proposes them as "AI SUGGESTION" with the user required to confirm.

### 2. `/api/explain` — Results interpretation
Receives the pre-calculated numerical results and writes a plain-language explanation. The LLM **does not calculate** any numbers. It only interprets the results that Python already computed.

---

## How the Backtesting Engine Works

Located in `backend/app/services/backtest.py`. Pure pandas/numpy — no external backtesting library.

```
1. Load NIFTY daily OHLC data for the requested date range.
2. Compute daily percentage change: pct_change = (close_today - close_yesterday) / close_yesterday * 100
3. Signal days: rows where pct_change ≤ -threshold_pct
4. Entry: open price on the next trading day after a signal
5. Exit: open price N trading days after entry (holding_period_days)
6. raw_return = (exit_price - entry_price) / entry_price
7. net_return = raw_return - transaction_cost_pct/100 - transaction_cost_pct/100  (buy leg + sell leg)
8. Aggregate: n_trades, n_profitable, win_rate, avg_return, median_return, best, worst, cumulative
```

The engine is unit-tested with known inputs and expected outputs (`backend/tests/test_backtest.py`).

---

## Data

The backend tries two data sources in order:

1. **Real data** via `yfinance` (`^NSEI`) — requires internet connectivity and `yfinance` installed.
2. **Synthetic sample data** — a statistically-calibrated CSV generated from NIFTY 50 historical properties (mean daily return ~0.04%, daily volatility ~1.1%, 2018–2025). Bundled in `backend/app/data/nifty_sample.csv`.

**The UI always shows which data source was used.** Synthetic data is explicitly labelled with a warning banner.

---

## How to Run Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- An OpenRouter API key (https://openrouter.ai)

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Optional: install yfinance for real NIFTY data
pip install yfinance

# Copy and fill in environment variables
copy .env.example .env
# Edit .env: set OPENROUTER_API_KEY and optionally OPENROUTER_MODEL

# Generate sample data (optional — auto-generated on first run)
python -m app.data.generate_sample

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open `http://localhost:3000` in your browser.

### Running Tests

```bash
cd backend
venv\Scripts\activate
pytest tests/ -v
```

---

## Environment Variables

```env
# Required
OPENROUTER_API_KEY=sk-or-...

# Optional (default: anthropic/claude-3.5-haiku)
OPENROUTER_MODEL=anthropic/claude-3.5-haiku

# Optional (displayed in OpenRouter dashboard)
OPENROUTER_SITE_NAME=AI Trading Research Assistant
```

---

## Limitations

1. **Single instrument** — only NIFTY 50 (index-based, price-only).
2. **Simple entry rule** — only supports `price_drop` conditions in V0.
3. **No slippage modelling** — uses open price exactly; real execution may differ.
4. **No position sizing** — each trade is treated as equal-weight.
5. **No overlapping trade handling** — trades may overlap if signals occur close together.
6. **Synthetic data** — real yfinance data requires internet; synthetic data is for demonstration only.
7. **No out-of-sample testing** — results cover a single fixed period.
8. **LLM consistency** — model quality depends on the configured OpenRouter model.
9. **No authentication** — this is a single-user prototype.
10. **No persistent state** — flow state is stored in `localStorage`; refreshing mid-flow may lose context.

---

## What Could Be Improved With More Time

| Area | Improvement |
|------|------------|
| Strategy rules | Support more condition types (volume, volatility, RSI, gaps) |
| Multi-instrument | Allow other Indian and global indices |
| Walk-forward testing | Proper out-of-sample validation with rolling windows |
| Monte Carlo analysis | Simulate trade sequence randomness |
| Benchmark comparison | Explicit buy-and-hold return over same period |
| Trade visualisation | Equity curve chart (e.g., Recharts) |
| Real data reliability | Proper data vendor (e.g., NSE API, Quandl) |
| Session persistence | Server-side session or database for multi-user use |
| Export | Download results as CSV or PDF |
| Parameter sweep | Test multiple parameter combinations systematically |
| Confidence intervals | Bootstrap-based confidence intervals on win rate |
