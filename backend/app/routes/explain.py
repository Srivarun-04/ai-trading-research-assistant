import logging
import time

from fastapi import APIRouter, HTTPException
from ..schemas.explain import ExplainRequest, ExplainResponse
from ..services.analysis import explain_results
from ..services.llm import LLMError

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/explain", response_model=ExplainResponse)
async def explain(request: ExplainRequest) -> ExplainResponse:
    """
    Use the LLM to interpret pre-calculated backtest results.
    The LLM receives numbers; it does not calculate anything.
    """
    t0 = time.perf_counter()
    try:
        result = await explain_results(request)
        total_time = time.perf_counter() - t0
        logger.info("[PERFORMANCE] Total /api/explain endpoint duration: %.2fs", total_time)
        return result
    except LLMError as exc:
        logger.error("LLM failure in /api/explain: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="The AI interpretation service didn't respond this time. Your backtest results are safe.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in /api/explain: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="The AI interpretation encountered an unexpected issue. Your backtest results are safe.",
        ) from exc
