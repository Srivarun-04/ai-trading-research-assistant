"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFlow } from "@/lib/store";
import { explainResults, ApiError } from "@/lib/api";
import StepIndicator from "@/components/StepIndicator";
import ExperimentPanel from "@/components/ExperimentPanel";
import ResultsPanel from "@/components/ResultsPanel";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

export default function ResultsPage() {
  const router = useRouter();
  const { state, setExplanation, reset } = useFlow();
  const { question, experiment, backtestResult, explanation } = state;

  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const hasRequestedRef = useRef(false);

  const fetchExplanation = useCallback(async () => {
    if (!backtestResult) return;
    setLoadingExplanation(true);
    setExplainError(null);
    try {
      const result = await explainResults(backtestResult);
      setExplanation(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setExplainError(err.message);
      } else {
        setExplainError("Could not generate explanation. You can still review the numbers above.");
      }
    } finally {
      setLoadingExplanation(false);
    }
  }, [backtestResult, setExplanation]);

  useEffect(() => {
    if (!backtestResult || !experiment) {
      router.replace("/");
      return;
    }
    // Auto-fetch explanation once if not already loaded
    if (!explanation && !loadingExplanation && !hasRequestedRef.current) {
      hasRequestedRef.current = true;
      fetchExplanation();
    }
  }, [backtestResult, experiment, explanation, loadingExplanation, router, fetchExplanation]);

  if (!backtestResult || !experiment) {
    return <LoadingState message="Loading results…" />;
  }

  const handleNewResearch = () => {
    reset();
    router.push("/");
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <StepIndicator current="learn" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Results</h1>
          {question && (
            <p className="mt-1 text-sm text-zinc-400">
              Research question:{" "}
              <span className="italic text-zinc-300">&ldquo;{question}&rdquo;</span>
            </p>
          )}
        </div>
      </div>

      {/* Experiment summary (collapsed) */}
      <details className="group">
        <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
          <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          View experiment definition
        </summary>
        <div className="mt-4">
          <ExperimentPanel experiment={experiment} />
        </div>
      </details>

      {/* Results */}
      {loadingExplanation && !explanation ? (
        <div className="flex flex-col gap-6">
          {/* Show numbers immediately, loading explanation */}
          <ResultsPanel result={backtestResult} />
          <LoadingState
            question={question}
            title="Generating AI interpretation"
            stages={[
              { label: "Backtest metrics computed", detail: "Python calculation completed successfully" },
              { label: "Consulting quantitative AI model", detail: "Interpreting win rate, returns, and signal patterns" },
              { label: "Formulating research caveats", detail: "Checking for regime bias, sample size, and transaction costs" },
              { label: "Structuring next research hypotheses", detail: "Formulating 4 actionable follow-up questions" },
            ]}
          />
        </div>
      ) : (
        <ResultsPanel result={backtestResult} explanation={explanation} />
      )}

      {/* Explanation error */}
      {explainError && (
        <ErrorState
          title="Could not generate AI explanation"
          message={explainError}
          onRetry={fetchExplanation}
        />
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-zinc-800/60">
        <button
          id="new-research-button"
          onClick={handleNewResearch}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Research Question
        </button>

        <button
          onClick={() => router.push("/experiment")}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Modify experiment
        </button>
      </div>
    </div>
  );
}
