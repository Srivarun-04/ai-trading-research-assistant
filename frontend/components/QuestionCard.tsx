"use client";

import { useState } from "react";
import type { ClarificationQuestion } from "@/lib/types";

interface QuestionCardProps {
  question: ClarificationQuestion;
  value: string;
  onChange: (field: string, value: string) => void;
}

export default function QuestionCard({
  question,
  value,
  onChange,
}: QuestionCardProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const suggested = question.options.find((o) => o.is_suggested);
  const isCustomSelected = value === "__custom__" || customMode;

  const handleOptionClick = (optValue: string) => {
    setCustomMode(false);
    onChange(question.field, optValue);
  };

  const handleCustomClick = () => {
    setCustomMode(true);
    onChange(question.field, "__custom__");
  };

  const handleCustomChange = (v: string) => {
    setCustomValue(v);
    onChange(question.field, v);
  };

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-5 flex flex-col gap-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-zinc-100">{question.label}</h3>
        <p className="mt-1 text-sm text-zinc-400">{question.description}</p>
        {question.why_it_matters && (
          <div className="mt-2.5 flex items-start gap-2 px-3 py-2 rounded-lg bg-zinc-900/70 border border-zinc-700/60 text-xs">
            <span className="text-indigo-400 font-semibold flex-shrink-0">Why this matters:</span>
            <span className="text-zinc-400 leading-relaxed">{question.why_it_matters}</span>
          </div>
        )}
        {suggested && !value && (
          <p className="mt-2 text-xs text-amber-400/80">
            Suggested starting point: {suggested.label}
          </p>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {question.options.map((opt) => {
          const isSelected = value === opt.value && !customMode;
          return (
            <button
              key={opt.value}
              onClick={() => handleOptionClick(opt.value)}
              className={`
                flex items-center justify-between px-4 py-3 rounded-lg border text-sm text-left
                transition-colors duration-150
                ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-200"
                    : "border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                }
              `}
            >
              <span>{opt.label}</span>
              <div className="flex items-center gap-2">
                {opt.is_suggested && (
                  <span className="text-[10px] font-semibold tracking-wider text-amber-400/80 uppercase">
                    Suggested
                  </span>
                )}
                {isSelected && (
                  <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}

        {/* Custom input */}
        {question.allows_custom && (
          <div>
            {!isCustomSelected ? (
              <button
                onClick={handleCustomClick}
                className="px-4 py-3 rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors w-full text-left"
              >
                Custom value…
              </button>
            ) : (
              <div className="rounded-lg border border-indigo-500 bg-indigo-500/5 p-3 flex flex-col gap-2">
                <label className="text-xs font-medium text-indigo-400">
                  {question.custom_label ?? "Enter custom value"}
                </label>
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="e.g. 2.5"
                  className="bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (!customValue.trim()) {
                      setCustomMode(false);
                      onChange(question.field, "");
                    }
                  }}
                  className="self-start text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
