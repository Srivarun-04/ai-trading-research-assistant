from fastapi import APIRouter, HTTPException
from ..schemas.analysis import AnalyzeRequest, AnalyzeResponse
from ..services.analysis import analyze_question
from ..services.llm import LLMError

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Parse a natural-language trading question into structured analysis
    and identify clarification questions.
    """
    if not request.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    try:
        return await analyze_question(request.question)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
