"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFlow } from "@/lib/store";
import { buildExperiment, ApiError } from "@/lib/api";
import StepIndicator from "@/components/StepIndicator";
import QuestionCard from "@/components/QuestionCard";
import TagBadge from "@/components/TagBadge";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import type { AnalysisResult, SourceType } from "@/lib/types";

// Map field names to display labels for the understanding panel
const FIELD_LABELS: Record<string, string> = {
  instrument: "Market",
  timeframe: "Timeframe",
  entry_condition_type: "Entry signal",
  threshold_pct: "Drop threshold",
  holding_period_days: "Holding period",
  test_period_start: "Test period (start)",
  test_period_end: "Test period (end)",
  transaction_cost_pct: "Transaction cost",
};

const FIELD_FORMAT: Record<string, (v: string) => string> = {
  threshold_pct: (v) => `${v}% one-day decline`,
  holding_period_days: (v) => `${v} trading days`,
  transaction_cost_pct: (v) => `${v}% per leg`,
  entry_condition_type: (v) =>
    v === "price_drop" ? "Buy after price drop" : v,
};

function formatValue(field: string, value: string | null): string {
  if (!value) return "—";
  const fmt = FIELD_FORMAT[field];
  return fmt ? fmt(value) : value;
}

interface AnalysisSummaryProps {
  analysis: AnalysisResult;
}

function AnalysisSummary({ analysis }: AnalysisSummaryProps) {
  const fields: Array<{ key: string; sourced: { value: string | null; source: SourceType } }> = [
    { key: "instrument", sourced: analysis.instrument },
    { key: "timeframe", sourced: analysis.timeframe },
    { key: "entry_condition_type", sourced: analysis.entry_condition_type },
    { key: "threshold_pct", sourced: analysis.threshold_pct },
    { key: "holding_period_days", sourced: analysis.holding_period_days },
    { key: "test_period_start", sourced: analysis.test_period_start },
    { key: "transaction_cost_pct", sourced: analysis.transaction_cost_pct },
  ];

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/30 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-700/40 bg-zinc-800/50">
        <h2 className="text-sm font-semibold text-zinc-100">What the AI understood</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Fields are colour-coded to show their origin.
        </p>
      </div>
      <div className="divide-y divide-zinc-700/30">
        {fields.map(({ key, sourced }) => (
          <div key={key} className="flex items-center justify-between px-5 py-3 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">{FIELD_LABELS[key] ?? key}</span>
              <span className={`text-sm ${sourced.source === "missing" ? "text-zinc-600 italic" : "text-zinc-100"}`}>
                {formatValue(key, sourced.value)}
              </span>
            </div>
            <TagBadge source={sourced.source} />
          </div>
        ))}
      </div>
      {/* Hypothesis */}
      <div className="px-5 py-4 border-t border-zinc-700/40 bg-zinc-900/20">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
          Hypothesis
        </p>
        <p className="text-sm text-zinc-300 italic leading-relaxed">
          &ldquo;{analysis.hypothesis}&rdquo;
        </p>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  const router = useRouter();
  const { state, setConfirmedParams, setExperiment } = useFlow();
  const { question, analysis } = state;

  // Redirect if arrived here without data
  useEffect(() => {
    if (!question || !analysis || !analysis.analysis) {
      router.replace("/");
    }
  }, [question, analysis, router]);

  // Selected values for each clarification question
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!analysis || !analysis.analysis) {
    return <LoadingState message="Loading analysis…" />;
  }

  const data = analysis.analysis;
  const needs_clarification = analysis.needs_clarification;
  const questions = data.clarification_questions;

  // Check that all clarification questions have been answered
  const allAnswered = questions.every((q) => {
    const val = answers[q.field];
    return val && val.trim() !== "" && val !== "__custom__";
  });

  const handleAnswer = (field: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const handleContinue = async () => {
    setLoading(true);
    setError(null);

    // Build confirmed_params and field_sources from analysis + user answers
    const confirmed: Record<string, string> = {};
    const sources: Record<string, string> = {};

    // Fixed fields from analysis
    const fixedFields: Array<{ key: string; sourced: { value: string | null; source: SourceType } }> = [
      { key: "instrument", sourced: data.instrument },
      { key: "timeframe", sourced: data.timeframe },
      { key: "entry_condition_type", sourced: data.entry_condition_type },
      { key: "threshold_pct", sourced: data.threshold_pct },
      { key: "holding_period_days", sourced: data.holding_period_days },
      { key: "test_period_start", sourced: data.test_period_start },
      { key: "test_period_end", sourced: data.test_period_end },
      { key: "transaction_cost_pct", sourced: data.transaction_cost_pct },
    ];

    for (const { key, sourced } of fixedFields) {
      if (sourced.value) {
        confirmed[key] = sourced.value;
        sources[key] = sourced.source;
      }
    }

    // Override with user answers for clarification questions
    for (const [field, val] of Object.entries(answers)) {
      confirmed[field] = val;
      sources[field] = "user_confirmed";
    }

    confirmed["hypothesis"] = data.hypothesis;

    try {
      setConfirmedParams(confirmed, sources);
      const resp = await buildExperiment({
        original_question: question,
        confirmed_params: confirmed,
        field_sources: sources,
      });
      setExperiment(resp.experiment);
      router.push("/experiment");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not build experiment. Please check your inputs.");
      }
    } finally {
      setLoading(false);
    }
  };

  const step = needs_clarification ? "clarify" : "define";

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <StepIndicator current={step} />
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">
            {needs_clarification ? "A few quick questions" : "Here's what we found"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Question:{" "}
            <span className="italic text-zinc-300">&ldquo;{question}&rdquo;</span>
          </p>
        </div>
      </div>

      {/* AI Understanding Summary */}
      <AnalysisSummary analysis={data} />

      {/* Clarification questions */}
      {needs_clarification && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Define the missing parameters
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              The AI identified{" "}
              <strong className="text-zinc-200">{questions.length}</strong>{" "}
              parameter{questions.length !== 1 ? "s" : ""} that need your input
              before we can run a meaningful test.
            </p>
          </div>

          {questions.map((q) => (
            <QuestionCard
              key={q.field}
              question={q}
              value={answers[q.field] ?? ""}
              onChange={handleAnswer}
            />
          ))}
        </section>
      )}

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {/* CTA */}
      <div className="flex items-center gap-4">
        <button
          id="continue-to-experiment"
          onClick={handleContinue}
          disabled={loading || (needs_clarification && !allAnswered)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Building experiment…
            </>
          ) : (
            <>
              Continue to Experiment Definition
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        {needs_clarification && !allAnswered && (
          <span className="text-xs text-zinc-500">
            Answer all questions above to continue.
          </span>
        )}

        <button
          onClick={() => router.push("/")}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Start over
        </button>
      </div>
    </div>
  );
}
