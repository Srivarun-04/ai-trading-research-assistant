/**
 * Typed API client for the FastAPI backend.
 * All requests go through /api/* which Next.js proxies to localhost:8000.
 * API keys are never exposed to the browser.
 */

import type {
  AnalyzeResponse,
  BuildExperimentRequest,
  BuildExperimentResponse,
  BacktestResult,
  ExperimentDefinition,
  ExplainResponse,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean = true,
    public errorType?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // If direct connection fails (e.g. CORS or different host), try fallback proxy /api
    if (BASE !== "/api") {
      try {
        res = await fetch(`/api${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        throw new ApiError(
          0,
          "The AI service didn't respond this time. Please check your backend connection.",
          true,
          "NETWORK_ERROR"
        );
      }
    } else {
      throw new ApiError(
        0,
        "The AI service didn't respond this time. Please check your backend connection.",
        true,
        "NETWORK_ERROR"
      );
    }
  }

  if (!res.ok) {
    let detail = "The AI service didn't respond this time.";
    let retryable = true;
    let errorType = "API_ERROR";
    try {
      const err = await res.json();
      if (err.detail) detail = err.detail;
      if (err.retryable !== undefined) retryable = err.retryable;
      if (err.error_type) errorType = err.error_type;
    } catch {
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        detail = "The AI service didn't respond this time.";
      } else {
        detail = `Server returned HTTP ${res.status}.`;
      }
    }
    throw new ApiError(res.status, detail, retryable, errorType);
  }

  return res.json() as Promise<TRes>;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export async function analyzeQuestion(question: string): Promise<AnalyzeResponse> {
  return post("/analyze", { question });
}

export async function buildExperiment(
  req: BuildExperimentRequest
): Promise<BuildExperimentResponse> {
  return post("/experiment", req);
}

export async function runBacktest(
  experiment: ExperimentDefinition
): Promise<BacktestResult> {
  return post("/backtest", { experiment });
}

export async function explainResults(
  result: BacktestResult
): Promise<ExplainResponse> {
  return post("/explain", { result });
}

export { ApiError };
