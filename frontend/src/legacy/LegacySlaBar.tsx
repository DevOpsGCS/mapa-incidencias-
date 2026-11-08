import { colorForSlaPercentage } from "./legacySla";

interface LegacySlaBarProps {
  /** 0-100, o null si el ticket no tiene SLA aplicable (ver computeSlaPercentage). */
  percentage: number | null;
}

// Mismo degradado siempre, a lo largo de TODO el ancho de la barra — lo que
// cambia con el % es cuánto de ese degradado queda revelado (scaleX), no el
// degradado en sí. Así el tramo revelado a bajo % siempre es verde, y solo
// entra en amarillo/rojo si el % real llega a esos tramos — los cortes
// (50%/75%) calzan con los mismos umbrales que ya usa SlaRing.
const SLA_GRADIENT = "linear-gradient(to right, var(--green) 0%, var(--amber) 50%, var(--red) 75%, var(--red) 100%)";

/** Misma lógica y colores que SlaRing (SLA consumido), en formato de barra horizontal para la tabla de tickets. */
export function LegacySlaBar({ percentage }: LegacySlaBarProps) {
  if (percentage === null) {
    return <span className="mono-label text-[10px] text-[color:var(--muted-2)]">—</span>;
  }

  const rounded = Math.round(percentage);
  const color = colorForSlaPercentage(percentage);

  return (
    <div className="flex items-center gap-2" title={`SLA consumido: ${rounded}%`}>
      <div className="relative h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-[color:var(--glass-border)]">
        <div
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${percentage / 100})`, background: SLA_GRADIENT }}
        />
      </div>
      <span className="mono-label whitespace-nowrap text-[10px] font-semibold" style={{ color }}>
        {rounded}%
      </span>
    </div>
  );
}
