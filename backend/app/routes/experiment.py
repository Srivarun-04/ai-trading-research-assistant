from fastapi import APIRouter, HTTPException
from ..schemas.experiment import BuildExperimentRequest, BuildExperimentResponse
from ..services.experiment import build_experiment

router = APIRouter()


@router.post("/experiment", response_model=BuildExperimentResponse)
async def create_experiment(request: BuildExperimentRequest) -> BuildExperimentResponse:
    """
    Build a validated ExperimentDefinition from the user's confirmed parameters.
    """
    try:
        return build_experiment(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
