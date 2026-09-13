"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFlow } from "@/lib/store";
import { runBacktest, ApiError } from "@/lib/api";
import StepIndicator from "@/components/StepIndicator";
import ExperimentPanel from "@/components/ExperimentPanel";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import type { ExperimentDefinition } from "@/lib/types";

export default function ExperimentPage() {
  const router = useRouter();
  const { state, setExperiment, setBacktestResult } = useFlow();
  const { question, experiment } = state;

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!experiment) {
      router.replace("/");
    }
  }, [experiment, router]);

  if (!experiment) {
    return <LoadingState message="Loading experiment…" />;
  }

  // Merge edits over the base experiment
  const currentExperiment: ExperimentDefinition = {
    ...experiment,
    threshold_pct:
      edits.threshold_pct !== undefined && edits.threshold_pct.trim() !== "" && !isNaN(Number(edits.threshold_pct))
        ? Number(edits.threshold_pct)
        : experiment.threshold_pct,
    holding_period_days:
      edits.holding_period_days !== undefined && edits.holding_period_days.trim() !== "" && !isNaN(Number(edits.holding_period_days))
        ? Math.round(Number(edits.holding_period_days))
        : experiment.holding_period_days,
  };

  const handleFieldChange = (field: string, value: string) => {
    setEdits((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleRunExperiment = async () => {
    const threshold = currentExperiment.threshold_pct;
    if (isNaN(threshold) || threshold <= 0 || threshold > 20) {
      setError("Condition threshold must be a number between 0.1% and 20%.");
      return;
    }

    const holding = currentExperiment.holding_period_days;
    if (isNaN(holding) || holding < 1 || holding > 252) {
      setError("Exit holding period must be an integer between 1 and 252 trading days.");
      return;
    }

    setLoading(true);
    setError(null);

    // Save any edits back into flow state
    setExperiment(currentExperiment);

    try {
      const result = await runBacktest(currentExperiment);
      setBacktestResult(result);
      router.push("/results");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Backtest failed. Please check the experiment parameters.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <StepIndicator current="define" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">
            Review your experiment
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Check every parameter before running. You can edit values directly.
          </p>
          {question && (
            <p className="mt-1 text-sm text-zinc-500">
              Original question:{" "}
              <span className="italic text-zinc-400">&ldquo;{question}&rdquo;</span>
            </p>
          )}
        </div>
      </div>

      {/* Experiment panel — editable */}
      <ExperimentPanel
        experiment={currentExperiment}
        rawEdits={edits}
        editable
        onChange={handleFieldChange}
      />

      {/* Limitations notice */}
      <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/20 p-4 flex flex-col gap-1">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          Limitations
        </p>
        <ul className="mt-1 space-y-1 text-xs text-zinc-500 list-disc list-inside">
          <li>This is a simple event-study backtest — not a production trading system.</li>
          <li>No portfolio sizing, position limits, or risk management.</li>
          <li>Results may use synthetic sample data (clearly labelled on results page).</li>
          <li>Past results under one experiment definition do not guarantee future returns.</li>
        </ul>
      </div>

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {loading && <LoadingState message="Running backtest engine…" />}

      {/* CTA */}
      <div className="flex items-center gap-4">
        <button
          id="run-experiment-button"
          onClick={handleRunExperiment}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Running…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Experiment
            </>
          )}
        </button>

        <button
          onClick={() => router.push("/analyze")}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Back to clarification
        </button>
      </div>
    </div>
  );
}
