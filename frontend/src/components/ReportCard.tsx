interface ReportCardProps {
  title: string;
  value: number | string;
  hint: string;
  /** `background-image` CSS del tinte de prioridad (priorityTint(rank, "card")). */
  tint?: string;
  /** Añade el glow rojo (--glow-critical) para el KPI crítico > 0. */
  critical?: boolean;
}

export function ReportCard({ title, value, hint, tint, critical }: ReportCardProps) {
  return (
    <div
      className="rounded-card border border-line glass p-4"
      style={{
        ...(tint ? { backgroundImage: tint } : {}),
        ...(critical ? { boxShadow: "var(--glass-edge), var(--glass-shadow), var(--glow-critical)" } : {}),
      }}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-label">{title}</div>
      <div className="mt-2 font-mono text-[32px] font-semibold leading-none text-text-strong">{value}</div>
      <div className="mt-2 text-xs text-text-muted">{hint}</div>
    </div>
  );
}
