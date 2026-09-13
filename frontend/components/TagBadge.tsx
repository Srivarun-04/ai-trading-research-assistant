import type { SourceType } from "@/lib/types";

interface TagBadgeProps {
  source: SourceType;
  className?: string;
}

const CONFIG: Record<
  SourceType,
  { label: string; className: string }
> = {
  user_provided: {
    label: "User provided",
    className: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  },
  ai_inferred: {
    label: "AI inferred",
    className: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
  },
  ai_suggested: {
    label: "AI suggested",
    className: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  },
  user_confirmed: {
    label: "User confirmed",
    className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  },
  system_default: {
    label: "System default",
    className: "bg-zinc-500/10 text-zinc-400 border border-zinc-600/40",
  },
  missing: {
    label: "Missing",
    className: "bg-red-500/10 text-red-400 border border-red-500/30",
  },
};

export default function TagBadge({ source, className = "" }: TagBadgeProps) {
  const { label, className: baseClass } = CONFIG[source] ?? CONFIG.ai_suggested;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-normal ${baseClass} ${className}`}
    >
      {label}
    </span>
  );
}
