import { CSSProperties, ReactNode } from "react";

export type PillTone = "neutral" | "accent" | "pending" | "error";

const TONE_STYLE: Record<PillTone, CSSProperties> = {
  neutral: { background: "var(--surface-3)", color: "var(--text-muted)" },
  accent: { background: "rgba(0,122,252,.14)", color: "var(--accent-text)" },
  pending: { background: "rgba(245,166,35,.14)", color: "var(--data-p1-text)" },
  error: { background: "rgba(255,77,109,.14)", color: "var(--data-p0-text)" },
};

/** Insignia de radio 4 del panel admin (rol, colas, departamentos). */
export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-[4px] px-2 py-0.5 text-xs font-medium"
      style={TONE_STYLE[tone]}
    >
      {children}
    </span>
  );
}
