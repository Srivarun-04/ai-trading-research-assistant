import type { BacktestResult, ExplainResponse } from "@/lib/types";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
}

function StatCard({ label, value, sub, positive, negative }: StatCardProps) {
  const valueClass = positive
    ? "text-emerald-400"
    : negative
    ? "text-red-400"
    : "text-zinc-100";

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-4 flex flex-col gap-1">
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}

interface ResultsPanelProps {
  result: BacktestResult;
  explanation?: ExplainResponse;
}

function sign(n: number) {
  return n >= 0 ? "+" : "";
}

function fmt(n: number, decimals = 2) {
  return `${sign(n)}${n.toFixed(decimals)}%`;
}

export default function ResultsPanel({ result, explanation }: ResultsPanelProps) {
  const exp = result.experiment;

  return (
    <div className="flex flex-col gap-8">
      {/* Data notice */}
      {result.data_label.includes("synthetic") || result.data_label.includes("Sample") ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-amber-300/80">{result.data_label}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-4 py-3">
          <p className="text-xs text-zinc-400">Data: {result.data_label}</p>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {result.warnings.map((w, i) => (
            <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-sm text-amber-300/80">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* --- Section 1: What the data shows --- */}
      <section>
        <SectionHeading label="What the data shows" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <StatCard
            label="Signal Days"
            value={String(result.n_signals)}
            sub={`${exp.threshold_pct}%+ falls found`}
          />
          <StatCard
            label="Trades Executed"
            value={String(result.n_trades)}
            sub="Complete round-trips"
          />
          <StatCard
            label="Profitable"
            value={`${result.n_profitable} / ${result.n_trades}`}
            sub={`Win rate: ${result.win_rate_pct.toFixed(1)}%`}
            positive={result.win_rate_pct >= 55}
            negative={result.win_rate_pct < 45}
          />
          <StatCard
            label="Win Rate"
            value={`${result.win_rate_pct.toFixed(1)}%`}
            positive={result.win_rate_pct >= 55}
            negative={result.win_rate_pct < 45}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <StatCard
            label="Average Return"
            value={fmt(result.avg_return_pct)}
            sub={`After ${exp.holding_period_days}-day hold`}
            positive={result.avg_return_pct > 0}
            negative={result.avg_return_pct < 0}
          />
          <StatCard
            label="Median Return"
            value={fmt(result.median_return_pct)}
            positive={result.median_return_pct > 0}
            negative={result.median_return_pct < 0}
          />
          <StatCard
            label="Cumulative"
            value={fmt(result.cumulative_return_pct)}
            sub="All trades compounded"
            positive={result.cumulative_return_pct > 0}
            negative={result.cumulative_return_pct < 0}
          />
          <StatCard
            label="Best Trade"
            value={fmt(result.best_return_pct)}
            positive
          />
          <StatCard
            label="Worst Trade"
            value={fmt(result.worst_return_pct)}
            negative
          />
          <StatCard
            label="vs. Market"
            value={fmt(result.avg_return_pct - result.avg_market_return_pct)}
            sub="Avg trade vs. avg window"
            positive={result.avg_return_pct > result.avg_market_return_pct}
            negative={result.avg_return_pct < result.avg_market_return_pct}
          />
        </div>
      </section>

      {/* --- Explanation (from LLM) --- */}
      {explanation ? (
        <>
          <section>
            <SectionHeading label="Interpretation" note="AI-generated — based only on the numbers above" />
            <div className="mt-3 rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-5">
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                {explanation.interpretation}
              </p>
            </div>
          </section>

          <section>
            <SectionHeading label="What we can reasonably conclude" />
            <div className="mt-3 rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-5">
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                {explanation.conclusions}
              </p>
            </div>
          </section>

          <section>
            <SectionHeading label="What to investigate next" />
            <ul className="mt-3 flex flex-col gap-2">
              {explanation.next_questions.map((q, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-4 py-3"
                >
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-zinc-300">{q}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {/* --- Trade table (collapsible) --- */}
      {result.trades.length > 0 && (
        <section>
          <SectionHeading label={`Individual Trades (${result.trades.length})`} />
          <div className="mt-3 rounded-xl border border-zinc-700/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-800/60 border-b border-zinc-700/40">
                    {["Signal Date", "Entry Date", "Exit Date", "Entry", "Exit", "Raw Return", "Net Return"].map(
                      (h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {result.trades.slice(0, 50).map((t, i) => (
                    <tr key={i} className="border-b border-zinc-700/20 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3 py-2 text-zinc-400">{t.signal_date}</td>
                      <td className="px-3 py-2 text-zinc-300">{t.entry_date}</td>
                      <td className="px-3 py-2 text-zinc-300">{t.exit_date}</td>
                      <td className="px-3 py-2 text-zinc-300 tabular-nums">{t.entry_price.toLocaleString()}</td>
                      <td className="px-3 py-2 text-zinc-300 tabular-nums">{t.exit_price.toLocaleString()}</td>
                      <td className={`px-3 py-2 tabular-nums font-medium ${t.raw_return_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmt(t.raw_return_pct, 3)}
                      </td>
                      <td className={`px-3 py-2 tabular-nums font-medium ${t.net_return_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmt(t.net_return_pct, 3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.trades.length > 50 && (
              <div className="px-3 py-2 bg-zinc-800/40 text-xs text-zinc-500">
                Showing first 50 of {result.trades.length} trades.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeading({ label, note }: { label: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-base font-semibold text-zinc-100">{label}</h2>
      {note && <span className="text-xs text-zinc-500">{note}</span>}
    </div>
  );
}
