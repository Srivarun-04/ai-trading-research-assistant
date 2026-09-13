interface ErrorStateProps {
  title?: string;
  subtitle?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = "The AI service didn't respond this time.",
  subtitle = "Your research question is still here.",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-zinc-900/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 w-5 h-5 text-amber-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-zinc-100">{title}</p>
          {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
          {message && message !== title && message !== subtitle && (
            <p className="text-xs text-zinc-500 mt-1">{message}</p>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="self-start sm:self-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-500 text-xs font-semibold text-zinc-100 rounded-lg transition-colors cursor-pointer flex-shrink-0 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try again
        </button>
      )}
    </div>
  );
}
