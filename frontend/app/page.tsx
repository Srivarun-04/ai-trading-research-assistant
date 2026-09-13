"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFlow } from "@/lib/store";
import { analyzeQuestion, ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

const EXAMPLE_QUESTIONS = [
  "Does buying NIFTY after a sharp fall work?",
  "Is there a Monday effect in NIFTY returns?",
  "Does NIFTY tend to recover after three consecutive down days?",
  "Does buying NIFTY after a 1% gap-down open produce positive returns?",
];

export default function HomePage() {
  const router = useRouter();
  const { setQuestion, setAnalysis } = useFlow();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentMessage, setIntentMessage] = useState<string | null>(null);

  const handleSubmit = async (question: string) => {
    const q = question.trim();
    if (!q) {
      setError("Please enter a research question.");
      setIntentMessage(null);
      return;
    }

    setLoading(true);
    setError(null);
    setIntentMessage(null);

    try {
      const result = await analyzeQuestion(q);

      // Fast deterministic intent gate caught an irrelevant/non-research question
      if (result.is_research_question === false) {
        setIntentMessage(result.message || "Please enter a trading research question.");
        return;
      }

      setQuestion(q);
      setAnalysis(result);
      router.push("/analyze");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to connect to the server. Please ensure the backend is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-16">
      {/* Hero */}
      <section className="flex flex-col gap-4 pt-8">
        <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/5 text-xs font-medium text-indigo-400">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Research Prototype — V1
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100 leading-tight">
          AI Trading Research{" "}
          <span className="text-indigo-400">Assistant</span>
        </h1>

        <p className="text-base text-zinc-400 max-w-xl leading-relaxed">
          Turn a market question into a testable experiment.
          AI identifies what&rsquo;s ambiguous, you confirm the parameters, Python
          runs the numbers.
        </p>

        {/* Workflow pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {["Ask", "Clarify", "Define", "Test", "Learn"].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className="font-semibold text-zinc-300">{s}</span>
              {i < arr.length - 1 && <span>→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* Input */}
      <section className="flex flex-col gap-4">
        <div className="relative">
          <textarea
            id="research-question"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
              setIntentMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(input);
              }
            }}
            placeholder="Does buying NIFTY after a sharp fall work?"
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-4 pr-16 text-base text-zinc-100 placeholder:text-zinc-600 resize-none outline-none focus:border-indigo-500 transition-colors leading-relaxed"
            disabled={loading}
          />
          <span className="absolute bottom-3 right-4 text-xs text-zinc-600">
            ↵ Enter
          </span>
        </div>

        {/* Fast Intent Gate Response for Irrelevant Queries */}
        {intentMessage && (
          <div
            id="intent-response-card"
            className="flex items-start gap-3 p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/40 text-zinc-200"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400 text-sm mt-0.5">
              💬
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-zinc-200 leading-relaxed">{intentMessage}</p>
            </div>
          </div>
        )}

        {error && (
          <ErrorState
            title="The AI service didn't respond this time."
            subtitle="Your research question is still here."
            message={error}
            onRetry={() => handleSubmit(input)}
          />
        )}

        <button
          id="analyze-button"
          onClick={() => handleSubmit(input)}
          disabled={loading || !input.trim()}
          className="self-start flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Analyze Question
            </>
          )}
        </button>

        {loading && <LoadingState question={input} title="Analyzing your research question" />}
      </section>

      {/* Example questions */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          Example questions
        </p>
        <div className="flex flex-col gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              id={`example-${q.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`}
              onClick={() => {
                setInput(q);
                setError(null);
                setIntentMessage(null);
              }}
              className="text-left text-sm text-zinc-400 hover:text-zinc-100 px-4 py-3 rounded-lg border border-zinc-800 hover:border-zinc-600 bg-zinc-900/40 hover:bg-zinc-900 transition-all"
            >
              &ldquo;{q}&rdquo;
            </button>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section className="border-t border-zinc-800/60 pt-10">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">
          How it works
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: "🤖",
              title: "AI proposes",
              desc: "The LLM parses your question, identifies what's clear and what's missing.",
            },
            {
              icon: "✅",
              title: "You confirm",
              desc: "You review ambiguous parameters and confirm the exact experiment definition.",
            },
            {
              icon: "🧮",
              title: "Python tests",
              desc: "A deterministic engine calculates all numbers. The AI only explains results.",
            },
          ].map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 flex flex-col gap-2"
            >
              <span className="text-2xl">{p.icon}</span>
              <p className="text-sm font-semibold text-zinc-100">{p.title}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
