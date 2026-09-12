import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routes import analyze, experiment, backtest, explain

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Trading Research Assistant",
    description=(
        "Backend API for the AI Trading Research Assistant. "
        "Parses natural-language research questions, runs deterministic backtests, "
        "and explains results using an LLM."
    ),
    version="0.1.0",
)

# Allow the Next.js dev server and production frontend across localhost/127.0.0.1/LAN
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):3000$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global unhandled exception handler to protect against unexpected 500 crashes
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("[ERROR] Unhandled server error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={
            "detail": "The AI service encountered a temporary issue. Your question and parameters are preserved.",
            "error_type": "INTERNAL_RETRYABLE",
            "retryable": True,
        },
    )

# Register routers
app.include_router(analyze.router, prefix="/api", tags=["Analysis"])
app.include_router(experiment.router, prefix="/api", tags=["Experiment"])
app.include_router(backtest.router, prefix="/api", tags=["Backtest"])
app.include_router(explain.router, prefix="/api", tags=["Explain"])


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "AI Trading Research Assistant"}
