import logging
import time

from fastapi import APIRouter, HTTPException
from ..schemas.analysis import AnalyzeRequest, AnalyzeResponse
from ..services.analysis import analyze_question
from ..services.intent import check_intent
from ..services.llm import LLMError

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Parse a natural-language trading question into structured analysis
    and identify clarification questions.
    """
    t0 = time.perf_counter()
    q_clean = request.question.strip()
    if not q_clean:
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    # 1. Fast deterministic intent gate (<1ms, no external LLM calls)
    is_research, immediate_msg = check_intent(q_clean)
    gate_duration_ms = (time.perf_counter() - t0) * 1000
    logger.info("[INTENT GATE] check_intent took %.3fms; is_research=%s", gate_duration_ms, is_research)

    if not is_research:
        logger.info("[INTENT GATE] Query deemed non-research: %r -> immediate response bypass", q_clean)
        return AnalyzeResponse(
            is_research_question=False,
            message=immediate_msg or "Please enter a trading research question.",
            analysis=None,
            needs_clarification=False,
        )

    # 2. Legitimate or ambiguous trading research query -> LLM analysis pipeline
    try:
        result = await analyze_question(request.question)
        total_time = time.perf_counter() - t0
        logger.info("[PERFORMANCE] Total /api/analyze endpoint duration: %.2fs", total_time)
        return result
    except LLMError as exc:
        logger.error("LLM failure in /api/analyze: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="The AI service didn't respond this time. Your research question is still here.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in /api/analyze: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="The AI service encountered an unexpected issue. Your research question is still here.",
        ) from exc
