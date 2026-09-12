from fastapi import APIRouter, HTTPException
from ..schemas.explain import ExplainRequest, ExplainResponse
from ..services.analysis import explain_results
from ..services.llm import LLMError

router = APIRouter()


@router.post("/explain", response_model=ExplainResponse)
async def explain(request: ExplainRequest) -> ExplainResponse:
    """
    Use the LLM to interpret pre-calculated backtest results.
    The LLM receives numbers; it does not calculate anything.
    """
    try:
        return await explain_results(request)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
