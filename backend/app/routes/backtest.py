from fastapi import APIRouter, HTTPException
from ..schemas.backtest import BacktestRequest, BacktestResult
from ..services.backtest import run_backtest, BacktestError

router = APIRouter()


@router.post("/backtest", response_model=BacktestResult)
async def backtest(request: BacktestRequest) -> BacktestResult:
    """
    Run a deterministic backtest for the given experiment definition.
    All calculations are performed in Python — no LLM is called here.
    """
    try:
        return run_backtest(request.experiment)
    except BacktestError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected backtest error: {exc}")
