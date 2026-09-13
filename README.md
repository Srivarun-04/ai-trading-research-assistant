# AI Trading Research Assistant

## Overview

The AI Trading Research Assistant is a full-stack research prototype designed to turn vague, natural-language trading ideas into structured, testable quantitative experiments. 

When traders ask questions like *"Does buying NIFTY after a sharp fall work?"*, the premise cannot be tested immediately because critical variables—such as entry threshold, holding duration, and execution timing—are underspecified. This project solves that ambiguity by using an AI-guided workflow:
1. **Ask**: The user submits a free-form trading research question.
2. **Clarify**: The AI extracts known parameters and highlights missing or ambiguous assumptions.
3. **Define**: The user reviews, customizes, and approves a structured experiment specification.
4. **Test**: A deterministic Python engine calculates returns, win rate, and drawdown using historical or statistical benchmark data without relying on LLM arithmetic.
5. **Learn**: The AI interprets the deterministic statistics, highlights caveats, and suggests structured follow-up hypotheses.

## Key Features

- **Natural Language Parsing**: Identifies instruments, conditions, thresholds, and holding horizons from plain text questions.
- **Fast Deterministic Intent Gate**: Sub-millisecond rule check that filters out greetings, jokes, or non-trading queries before invoking external AI models.
- **Explicit Parameter Attribution**: Color-coded badges denote whether parameters were user-provided, AI-inferred, AI-suggested, user-confirmed, or system defaults.
- **Interactive Experiment Definition**: Interactive steppers and presets for adjusting decline thresholds (0.1%–20%) and holding periods (1–252 days) before running backtests.
- **Deterministic Backtesting Engine**: Event-study backtesting implemented entirely in Pandas and NumPy, ensuring accurate return calculations and realistic round-trip transaction costs.
- **Dual Data Source Support**: Seamless fallback between real historical data (`yfinance` for `^NSEI`) and a statistically-calibrated benchmark dataset (`nifty_sample.csv`), with transparent data-origin indicators.
- **AI-Powered Interpretation**: LLM explains calculated performance metrics, identifies potential regime biases, and proposes four structured follow-up research questions.
- **Persistent Multi-Step Flow**: State management using React `useSyncExternalStore` synchronized with `localStorage` across all steps.

## Architecture

The project follows a clean separation of concerns:

```
[User Browser]
       │
       ▼
[Next.js App Router] (Frontend UI + Client State + Route Pages)
       │
       ▼  HTTP / JSON (or Next.js API Rewrite Proxy)
[FastAPI Backend] (`app.main:app`)
  ├── [Intent Gate] (Sub-millisecond regex / rule filtering)
  ├── [Analysis Service] (OpenRouter LLM structured extraction)
  ├── [Experiment Service] (Pydantic schema validation)
  ├── [Backtest Service] (Deterministic Pandas / NumPy calculation engine)
  │     └── [Data Loader] (yfinance API or calibrated CSV fallback)
  └── [Explain Service] (OpenRouter LLM qualitative interpretation)
```

**Flow Pattern**:
Frontend → FastAPI API → Services → Data/Analysis → Response

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **State Management**: React `useSyncExternalStore` with browser `localStorage`
- **Backend API**: FastAPI, Uvicorn, Pydantic v2, Pydantic Settings
- **AI Integration**: OpenRouter API (`httpx` async client)
- **Data Analysis & Calculations**: Pandas, NumPy
- **Testing**: Pytest, Pytest-Asyncio
- **Code Quality**: ESLint 9 (`eslint-config-next`), TypeScript compiler (`tsc`)

## Project Structure

```
ai-trading-research-assistant/
├── README.md                      # Comprehensive project documentation
├── .env.example                   # Environment variable template for the repository
├── .gitignore                     # Git ignore rules for monorepo
├── backend/
│   ├── .env.example               # Backend-specific environment template
│   ├── requirements.txt           # Python dependencies
│   ├── app/
│   │   ├── main.py                # FastAPI entrypoint, middleware, and route mounting
│   │   ├── config.py              # Centralized Pydantic application settings
│   │   ├── routes/                # API route handlers
│   │   │   ├── analyze.py         # POST /api/analyze endpoint
│   │   │   ├── experiment.py      # POST /api/experiment endpoint
│   │   │   ├── backtest.py        # POST /api/backtest endpoint
│   │   │   └── explain.py         # POST /api/explain endpoint
│   │   ├── schemas/               # Pydantic request and response models
│   │   │   ├── analysis.py        # Analysis and clarification schemas
│   │   │   ├── experiment.py      # Experiment definition schemas
│   │   │   ├── backtest.py        # Trade and backtest result schemas
│   │   │   └── explain.py         # AI explanation schemas
│   │   ├── services/              # Core business and calculation logic
│   │   │   ├── intent.py          # Fast deterministic intent gate
│   │   │   ├── analysis.py        # Prompt construction & analysis orchestration
│   │   │   ├── experiment.py      # Experiment assembly and validation
│   │   │   ├── backtest.py        # Deterministic pandas event-study engine
│   │   │   └── llm.py             # OpenRouter API client with fallback handling
│   │   └── data/
│   │       ├── loader.py          # Data ingestion (yfinance with local fallback)
│   │       ├── nifty_sample.csv   # Historical/synthetic benchmark NIFTY 50 prices
│   │       └── generate_sample.py # Generator for calibrated benchmark dataset
│   └── tests/
│       ├── test_backtest.py       # Unit tests for signal detection and return math
│       └── test_intent.py         # Unit tests for intent filtering and latency
└── frontend/
    ├── package.json               # Frontend dependencies and scripts
    ├── tsconfig.json              # TypeScript configuration
    ├── next.config.ts             # Next.js configuration and API proxy rewrites
    ├── eslint.config.mjs          # ESLint flat configuration
    ├── app/
    │   ├── layout.tsx             # Root layout with navigation header and footer
    │   ├── page.tsx               # Step 1 (Ask): Question input and examples
    │   ├── globals.css            # Tailwind CSS styling and theme definitions
    │   ├── analyze/page.tsx       # Step 2 (Clarify): AI understanding and question cards
    │   ├── experiment/page.tsx    # Step 3 (Define): Parameter review and editing
    │   └── results/page.tsx       # Step 4 (Learn): Backtest metrics and AI explanation
    ├── components/                # Reusable UI components
    │   ├── StepIndicator.tsx      # Workflow step progress bar
    │   ├── QuestionCard.tsx       # Interactive clarification option card
    │   ├── ExperimentPanel.tsx    # Detailed experiment breakdown table
    │   ├── ResultsPanel.tsx       # Metric cards and individual trade history table
    │   ├── LoadingState.tsx       # Multi-stage progress indicator with timer
    │   ├── ErrorState.tsx         # User-friendly error message with retry action
    │   └── TagBadge.tsx           # Parameter attribution badge
    ├── lib/
    │   ├── api.ts                 # Typed fetch client with error handling
    │   ├── store.tsx              # Flow state management (useSyncExternalStore)
    │   └── types.ts               # Shared TypeScript interfaces
    └── public/
        └── favicon.ico            # Favicon asset
```

## Setup & Installation

### Prerequisites
- Python 3.11 or higher
- Node.js 18.18 or higher (Node.js 20+ recommended)
- An OpenRouter API Key ([https://openrouter.ai](https://openrouter.ai))

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Srivarun-04/ai-trading-research-assistant.git
cd ai-trading-research-assistant
```

---

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in both the root directory and the `backend/` directory:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
Copy-Item .env.example backend\.env

# macOS / Linux
cp .env.example .env
cp .env.example backend/.env
```

Open `backend/.env` in your editor and provide your OpenRouter API key:
```env
OPENROUTER_API_KEY=your_actual_api_key_here
```

---

### Step 3: Backend Setup
From the repository root:

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (cmd.exe):
.\venv\Scripts\activate.bat
# macOS / Linux:
source venv/bin/activate

# Install required packages
pip install -r requirements.txt

# Start the backend server
uvicorn app.main:app --reload --port 8000
```
The backend API will be running at `http://127.0.0.1:8000`. You can verify health at `http://127.0.0.1:8000/health`.

---

### Step 4: Frontend Setup
Open a second terminal, navigate to `frontend/`, and install dependencies:

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
Open `http://localhost:3000` in your web browser.

## Environment Variables

| Variable | Description | Default / Example | Required |
| :--- | :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | OpenRouter API authentication key | `sk-or-v1-...` | **Yes** |
| `OPENROUTER_MODEL` | LLM model identifier for extraction and explanation | `nvidia/nemotron-3-super-120b-a12b:free` | No |
| `OPENROUTER_SITE_NAME` | Site attribution header sent to OpenRouter | `AI Trading Research Assistant` | No |
| `NEXT_PUBLIC_API_URL` | Optional frontend API endpoint override | `http://127.0.0.1:8000/api` | No |

## API / Backend

The backend exposes four core REST endpoints under `/api`:

### 1. `POST /api/analyze`
- **Purpose**: Parses a free-text trading question, runs intent gating, and extracts known parameters and clarification questions using the LLM.
- **Request Body**: `{"question": "Does buying NIFTY after a sharp fall work?"}`
- **Response**: Structured analysis object containing field origins (`user_provided`, `ai_inferred`, `missing`), suggested options, and clarification prompts.

### 2. `POST /api/experiment`
- **Purpose**: Validates user-confirmed parameters and compiles a finalized `ExperimentDefinition`.
- **Request Body**: `{"original_question": "...", "confirmed_params": {...}, "field_sources": {...}}`
- **Response**: Normalized `ExperimentDefinition` ready for backtesting.

### 3. `POST /api/backtest`
- **Purpose**: Executes the deterministic backtest engine in Python. No LLM arithmetic is involved.
- **Request Body**: `{"experiment": {...}}`
- **Response**: Comprehensive statistics (`n_signals`, `n_trades`, `win_rate_pct`, `avg_return_pct`, `median_return_pct`, `cumulative_return_pct`, individual trade records).

### 4. `POST /api/explain`
- **Purpose**: Supplies pre-calculated numerical backtest results to the LLM to generate qualitative interpretation, caveats, and next hypotheses.
- **Request Body**: `{"experiment": {...}, "result": {...}}`
- **Response**: Structured interpretation text, conclusions, and four follow-up research questions.

## Running Tests

### Backend Unit Tests
The backend test suite covers signal detection accuracy, return calculations, transaction cost deductions, edge cases, and intent gate latency.

```bash
cd backend
# With virtual environment activated:
pytest -v
```

### Frontend Build & Lint Verification
The frontend code adheres strictly to Next.js and TypeScript standards.

```bash
cd frontend

# Run linting check
npx eslint app components lib

# Run production build
npm run build
```

## Deployment

- **Frontend**: Ready for deployment on platforms such as Vercel. Set `NEXT_PUBLIC_API_URL` in the hosting environment to point to your deployed backend URL.
- **Backend**: Can be containerized or hosted on any ASGI-compatible platform (Render, Railway, Fly.io, AWS EC2).

## Demo

A comprehensive demonstration video showcasing the full end-to-end workflow (Ask → Clarify → Define → Test → Learn) is included with the assignment submission.

## Project Status

This repository represents the **final, completed assignment implementation**. All core requirements, edge case protections, error handling patterns, and test suites are implemented and verified.

## Notes & Limitations

1. **Demonstration & Educational Purpose**: This application is a research prototype and does not provide financial advice.
2. **Event-Study Methodology**: Backtesting uses an event-study model (fixed holding window following qualifying price declines) rather than an execution management system.
3. **Data Availability**: When real-time price downloads via Yahoo Finance are unavailable or fail network resolution, the system transparently falls back to the calibrated benchmark sample dataset (`nifty_sample.csv`). This condition is clearly labelled in the UI.
4. **Execution Modeling**: Slippage and market impact are simplified into a configurable round-trip transaction cost percentage (defaulting to 0.10% per leg).
