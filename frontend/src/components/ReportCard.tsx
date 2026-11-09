interface ReportCardProps {
  title: string;
  value: number | string;
  hint: string;
  /** `background-image` CSS del tinte de prioridad (priorityTint(rank, "card")). */
  tint?: string;
}

export function ReportCard({ title, value, hint, tint }: ReportCardProps) {
  return (
    <div
      className="rounded-card border border-line bg-surface-1 p-4"
      style={tint ? { backgroundImage: tint } : undefined}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-label">{title}</div>
      <div className="mt-2 font-mono text-[32px] font-semibold leading-none text-text-strong">{value}</div>
      <div className="mt-2 text-xs text-text-muted">{hint}</div>
    </div>
  );
}
