import React from "react";

const STEPS = [
  { id: "ask", label: "Ask" },
  { id: "clarify", label: "Clarify" },
  { id: "define", label: "Define" },
  { id: "test", label: "Test" },
  { id: "learn", label: "Learn" },
];

interface StepIndicatorProps {
  current: "ask" | "clarify" | "define" | "test" | "learn";
}

export default function StepIndicator({ current }: StepIndicatorProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Research workflow steps" className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold
                  transition-colors duration-200
                  ${isDone ? "bg-emerald-500 text-white" : ""}
                  ${isActive ? "bg-indigo-600 text-white ring-2 ring-indigo-300" : ""}
                  ${!isDone && !isActive ? "bg-zinc-800 text-zinc-500" : ""}
                `}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={`mt-1 text-[11px] font-medium tracking-wide uppercase
                  ${isActive ? "text-indigo-400" : isDone ? "text-emerald-400" : "text-zinc-600"}
                `}
              >
                {step.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-8 sm:w-12 mx-1 mb-5 transition-colors duration-200
                  ${i < currentIndex ? "bg-emerald-500" : "bg-zinc-700"}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
