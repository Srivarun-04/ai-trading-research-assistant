import TagBadge from "./TagBadge";
import type { ExperimentDefinition } from "@/lib/types";
import type { SourceType } from "@/lib/types";

interface ExperimentPanelProps {
  experiment: ExperimentDefinition;
  /** Raw string values being edited */
  rawEdits?: Record<string, string>;
  /** Override values for editing */
  editable?: boolean;
  onChange?: (field: string, value: string) => void;
}

interface FieldRowProps {
  label: string;
  source?: SourceType;
  children: React.ReactNode;
}

function FieldRow({ label, source, children }: FieldRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 py-4 border-b border-zinc-800/80 last:border-0">
      <div className="sm:w-52 flex-shrink-0 flex flex-col gap-1.5 pt-0.5">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
        {source && <TagBadge source={source} />}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function ExperimentPanel({
  experiment,
  rawEdits,
  editable = false,
  onChange,
}: ExperimentPanelProps) {
  const sources = experiment.field_sources;

  const src = (field: string): SourceType => {
    if (sources?.[field]) return sources[field] as SourceType;
    if (field === "transaction_cost_pct") return "system_default";
    if (field === "test_period_start" || field === "test_period_end" || field === "entry_condition_type") return "ai_inferred";
    return "ai_suggested";
  };

  const thresholdVal =
    rawEdits?.threshold_pct !== undefined
      ? rawEdits.threshold_pct
      : String(experiment.threshold_pct);

  const holdingVal =
    rawEdits?.holding_period_days !== undefined
      ? rawEdits.holding_period_days
      : String(experiment.holding_period_days);

  const stepThreshold = (delta: number) => {
    const current = parseFloat(thresholdVal) || experiment.threshold_pct || 2.0;
    const updated = Math.min(20, Math.max(0.1, Math.round((current + delta) * 10) / 10));
    onChange?.("threshold_pct", String(updated));
  };

  const stepHolding = (delta: number) => {
    const current = parseInt(holdingVal, 10) || experiment.holding_period_days || 5;
    const updated = Math.min(252, Math.max(1, current + delta));
    onChange?.("holding_period_days", String(updated));
  };

  const thresholdPresets = [1.0, 1.5, 2.0, 3.0, 5.0];
  const holdingPresets = [1, 3, 5, 10, 20];

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/30 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-700/60 bg-zinc-800/60">
        <h3 className="text-sm font-semibold text-zinc-100">Experiment Definition</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Fields are colour-coded to show their origin. You can adjust parameters directly below.
        </p>
      </div>

      {/* Fields */}
      <div className="px-5 py-2">
        <FieldRow label="Market" source={src("instrument")}>
          <span className="text-sm text-zinc-100 font-medium">{experiment.instrument}</span>
        </FieldRow>

        <FieldRow label="Timeframe" source={src("timeframe")}>
          <span className="text-sm text-zinc-100 capitalize">{experiment.timeframe}</span>
        </FieldRow>

        {/* Condition Field with interactive stepper and preset buttons */}
        <FieldRow label="Condition" source={src("threshold_pct")}>
          {editable ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                <span className="text-zinc-300 font-medium">Falls ≥</span>
                <div className="inline-flex items-center rounded-lg border border-zinc-600 bg-zinc-900/90 overflow-hidden shadow-inner focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                  <button
                    type="button"
                    id="threshold-decrement-btn"
                    onClick={() => stepThreshold(-0.5)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors border-r border-zinc-700 font-bold select-none cursor-pointer"
                    title="Decrease threshold by 0.5%"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    id="threshold-input"
                    step="0.1"
                    min="0.1"
                    max="20"
                    value={thresholdVal}
                    onChange={(e) => onChange?.("threshold_pct", e.target.value)}
                    className="w-16 sm:w-20 bg-transparent px-2 py-1.5 text-center text-sm font-semibold text-zinc-100 outline-none"
                  />
                  <button
                    type="button"
                    id="threshold-increment-btn"
                    onClick={() => stepThreshold(0.5)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors border-l border-zinc-700 font-bold select-none cursor-pointer"
                    title="Increase threshold by 0.5%"
                  >
                    +
                  </button>
                </div>
                <span className="text-zinc-300 font-medium">% in one trading day</span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mr-1">
                  Presets:
                </span>
                {thresholdPresets.map((preset) => {
                  const isSelected = Math.abs(parseFloat(thresholdVal) - preset) < 0.01;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onChange?.("threshold_pct", String(preset))}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 font-semibold shadow-sm"
                          : "border-zinc-700/80 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                      }`}
                    >
                      {preset.toFixed(1)}%
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <span className="text-sm text-zinc-100">
              Falls ≥ {experiment.threshold_pct}% in one trading day
            </span>
          )}
        </FieldRow>

        <FieldRow label="Entry" source="ai_inferred">
          <span className="text-sm text-zinc-100">Buy at next trading day&apos;s open</span>
        </FieldRow>

        {/* Exit (Holding) Field with interactive stepper and preset buttons */}
        <FieldRow label="Exit (Holding)" source={src("holding_period_days")}>
          {editable ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                <span className="text-zinc-300 font-medium">After</span>
                <div className="inline-flex items-center rounded-lg border border-zinc-600 bg-zinc-900/90 overflow-hidden shadow-inner focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                  <button
                    type="button"
                    id="holding-decrement-btn"
                    onClick={() => stepHolding(-1)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors border-r border-zinc-700 font-bold select-none cursor-pointer"
                    title="Decrease holding period by 1 day"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    id="holding-input"
                    step="1"
                    min="1"
                    max="252"
                    value={holdingVal}
                    onChange={(e) => onChange?.("holding_period_days", e.target.value)}
                    className="w-16 sm:w-20 bg-transparent px-2 py-1.5 text-center text-sm font-semibold text-zinc-100 outline-none"
                  />
                  <button
                    type="button"
                    id="holding-increment-btn"
                    onClick={() => stepHolding(1)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors border-l border-zinc-700 font-bold select-none cursor-pointer"
                    title="Increase holding period by 1 day"
                  >
                    +
                  </button>
                </div>
                <span className="text-zinc-300 font-medium">trading days</span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mr-1">
                  Presets:
                </span>
                {holdingPresets.map((preset) => {
                  const isSelected = parseInt(holdingVal, 10) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onChange?.("holding_period_days", String(preset))}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 font-semibold shadow-sm"
                          : "border-zinc-700/80 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                      }`}
                    >
                      {preset} {preset === 1 ? "day" : "days"}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <span className="text-sm text-zinc-100">
              After {experiment.holding_period_days} trading days
            </span>
          )}
        </FieldRow>

        <FieldRow label="Test Period" source={src("test_period_start")}>
          <span className="text-sm text-zinc-100">
            {experiment.test_period_start} → {experiment.test_period_end}
          </span>
        </FieldRow>

        <FieldRow label="Transaction Cost" source={src("transaction_cost_pct")}>
          <span className="text-sm text-zinc-100">
            {experiment.transaction_cost_pct}% per leg ({(experiment.transaction_cost_pct * 2).toFixed(2)}% round-trip)
          </span>
        </FieldRow>
      </div>

      {/* Hypothesis */}
      <div className="px-5 py-4 border-t border-zinc-700/60 bg-zinc-900/20">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
          Hypothesis
        </p>
        <p className="text-sm text-zinc-300 italic leading-relaxed">
          &ldquo;{experiment.hypothesis}&rdquo;
        </p>
      </div>
    </div>
  );
}

