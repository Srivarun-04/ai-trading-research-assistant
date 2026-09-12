"""
FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import analyze, experiment, backtest, explain

app = FastAPI(
    title="AI Trading Research Assistant",
    description=(
        "Backend API for the AI Trading Research Assistant. "
        "Parses natural-language research questions, runs deterministic backtests, "
        "and explains results using an LLM."
    ),
    version="0.1.0",
)

# Allow the Next.js dev server and production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(analyze.router, prefix="/api", tags=["Analysis"])
app.include_router(experiment.router, prefix="/api", tags=["Experiment"])
app.include_router(backtest.router, prefix="/api", tags=["Backtest"])
app.include_router(explain.router, prefix="/api", tags=["Explain"])


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "AI Trading Research Assistant"}
