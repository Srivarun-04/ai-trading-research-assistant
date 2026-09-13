// Shared TypeScript types that mirror the backend Pydantic schemas.
// Keep this file in sync with backend/app/schemas/*.py

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type SourceType =
  | "user_provided"
  | "ai_inferred"
  | "ai_suggested"
  | "missing"
  | "user_confirmed"
  | "system_default";

export interface SourcedValue {
  value: string | null;
  source: SourceType;
  note?: string;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface ClarificationOption {
  label: string;
  value: string;
  is_suggested: boolean;
}

export interface ClarificationQuestion {
  field: string;
  label: string;
  description: string;
  why_it_matters?: string;
  options: ClarificationOption[];
  allows_custom: boolean;
  custom_label?: string;
}

export interface AnalysisResult {
  instrument: SourcedValue;
  timeframe: SourcedValue;
  entry_condition_type: SourcedValue;
  threshold_pct: SourcedValue;
  holding_period_days: SourcedValue;
  test_period_start: SourcedValue;
  test_period_end: SourcedValue;
  transaction_cost_pct: SourcedValue;
  hypothesis: string;
  clarification_questions: ClarificationQuestion[];
}

export interface AnalyzeResponse {
  is_research_question?: boolean;
  message?: string | null;
  analysis?: AnalysisResult | null;
  needs_clarification: boolean;
}

// ---------------------------------------------------------------------------
// Experiment
// ---------------------------------------------------------------------------

export interface ExperimentDefinition {
  instrument: string;
  timeframe: string;
  entry_condition_type: string;
  threshold_pct: number;
  holding_period_days: number;
  test_period_start: string;
  test_period_end: string;
  transaction_cost_pct: number;
  hypothesis: string;
  field_sources: Record<string, string>;
}

export interface BuildExperimentRequest {
  original_question: string;
  confirmed_params: Record<string, string>;
  field_sources: Record<string, string>;
}

export interface BuildExperimentResponse {
  experiment: ExperimentDefinition;
}

// ---------------------------------------------------------------------------
// Backtest
// ---------------------------------------------------------------------------

export interface TradeRecord {
  signal_date: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  raw_return_pct: number;
  net_return_pct: number;
}

export interface BacktestResult {
  experiment: ExperimentDefinition;
  n_signals: number;
  n_trades: number;
  n_profitable: number;
  win_rate_pct: number;
  avg_return_pct: number;
  median_return_pct: number;
  best_return_pct: number;
  worst_return_pct: number;
  cumulative_return_pct: number;
  avg_market_return_pct: number;
  trades: TradeRecord[];
  data_start: string;
  data_end: string;
  data_label: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Explain
// ---------------------------------------------------------------------------

export interface ExplainResponse {
  what_data_shows: string;
  interpretation: string;
  conclusions: string;
  next_questions: string[];
}

// ---------------------------------------------------------------------------
// Flow state (stored in localStorage)
// ---------------------------------------------------------------------------

export interface FlowState {
  question: string;
  analysis?: AnalyzeResponse;
  confirmedParams?: Record<string, string>;
  fieldSources?: Record<string, string>;
  experiment?: ExperimentDefinition;
  backtestResult?: BacktestResult;
  explanation?: ExplainResponse;
}
