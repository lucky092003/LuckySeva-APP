export const DevOtpHint = ({ code, onFill }: { code: string | null; onFill?: () => void }) => {
  if (!code) return null;
  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
        Dev mode — no SMS provider yet
      </p>
      <button
        type="button"
        onClick={onFill}
        disabled={!onFill}
        className="mt-1.5 text-2xl font-extrabold tabular-nums tracking-[0.35em] text-amber-900 disabled:cursor-default"
      >
        {code}
      </button>
      {onFill && <p className="mt-1 text-[11px] text-amber-700">Tap the code to fill it in</p>}
    </div>
  );
};