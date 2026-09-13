"use client";

import { useEffect, useState } from "react";

interface LoadingStage {
  label: string;
  detail?: string;
}

interface LoadingStateProps {
  question?: string;
  title?: string;
  message?: string;
  stages?: LoadingStage[];
}

const DEFAULT_STAGES: LoadingStage[] = [
  { label: "Question received", detail: "Parsed text into analysis pipeline" },
  { label: "Understanding the market", detail: "Identifying index, asset class, and timeframe" },
  { label: "Checking for missing information", detail: "Waiting for AI model reasoning..." },
  { label: "Preparing experiment framework", detail: "Structuring parameters and validation schema" },
];

export default function LoadingState({
  question,
  title = "Analyzing your research question",
  message,
  stages = DEFAULT_STAGES,
}: LoadingStateProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine stage progression reasonably based on time elapsed
  // Stage 0: 0-1s
  // Stage 1: 1-3s
  // Stage 2: 3s+ (Waiting on LLM)
  // Stage 3: Pending until response arrives
  const currentStageIndex = elapsed < 1 ? 0 : elapsed < 3 ? 1 : 2;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col gap-6 max-w-xl mx-auto w-full my-4 shadow-sm">
      {/* Header & Question */}
      <div className="flex flex-col gap-2 pb-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            {title}
          </h3>
          <span className="text-xs font-mono text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded">
            {elapsed}s elapsed
          </span>
        </div>

        {question && (
          <p className="text-xs text-zinc-400">
            Research question:{" "}
            <span className="italic text-zinc-200">&ldquo;{question}&rdquo;</span>
          </p>
        )}
      </div>

      {/* Meaningful Stages */}
      <div className="flex flex-col gap-3.5">
        {stages.map((stage, idx) => {
          const isDone = idx < currentStageIndex;
          const isActive = idx === currentStageIndex;

          return (
            <div key={stage.label} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5 flex-shrink-0">
                {isDone ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                    ✓
                  </span>
                ) : isActive ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/30 animate-pulse">
                    ●
                  </span>
                ) : (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-zinc-600 text-xs font-bold border border-zinc-700/50">
                    ○
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <span
                  className={`font-medium leading-tight ${
                    isDone
                      ? "text-zinc-300"
                      : isActive
                      ? "text-indigo-300 font-semibold"
                      : "text-zinc-500"
                  }`}
                >
                  {stage.label}
                </span>
                {isActive && (
                  <span className="text-xs text-zinc-400 mt-0.5">
                    {stage.detail || message || "Waiting on AI response…"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Honest wait notice */}
      {elapsed >= 6 && (
        <div className="pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>AI models typically take 15–30 seconds for structured extraction.</span>
          <span className="italic text-zinc-600">Please keep this tab open</span>
        </div>
      )}
    </div>
  );
}
