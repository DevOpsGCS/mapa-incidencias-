import { useEffect, useState } from "react";
import { colorForSlaPercentage } from "../lib/sla";

interface SlaRingProps {
  /** 0-100, o null si el ticket no tiene SLA aplicable (ver computeSlaPercentage). */
  percentage: number | null;
  size?: number;
}

const RADIUS = 13;
const STROKE = 3;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const VIEWBOX_SIZE = (RADIUS + STROKE) * 2;
const CRITICAL_THRESHOLD = 75;
const ENTRANCE_DELAY_MS = 20; // fuerza un frame con offset=0 antes de animar al valor real

/**
 * Anillo de progreso de SLA con el % en el centro — mismo trío de colores
 * que ya usa el resto del dashboard para severidad (verde/amarillo/rojo).
 * La etiqueta "SLA" queda siempre visible debajo (no depende de hover) y,
 * si está por vencer (>75%), un punto titila en la esquina para que se
 * note incluso de reojo. El hover (escala + tooltip) es solo para ver el
 * detalle exacto — no dispara ninguna acción.
 *
 * Entrada animada: arranca en 0% con escala/opacidad reducidas y anima
 * hacia el valor real al montarse (setTimeout, no requestAnimationFrame:
 * rAF queda pausado con la pestaña en segundo plano, ver NotificationStack).
 * Los hooks van antes del "return null" para no violar las reglas de
 * hooks si percentage pasa de número a null entre renders del mismo ticket.
 */
export function SlaRing({ percentage, size = 42 }: SlaRingProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), ENTRANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (percentage === null) return null;

  const rounded = Math.round(percentage);
  const color = colorForSlaPercentage(percentage);
  const displayedPercentage = mounted ? percentage : 0;
  const offset = CIRCUMFERENCE * (1 - displayedPercentage / 100);
  const center = VIEWBOX_SIZE / 2;
  const isCritical = rounded > CRITICAL_THRESHOLD;

  return (
    <div
      className={`flex flex-shrink-0 flex-col items-center gap-0.5 transition-all duration-500 ease-out ${
        mounted ? "scale-100 opacity-100" : "scale-50 opacity-0"
      }`}
    >
      <div
        className="relative cursor-help transition-transform duration-150 hover:scale-110"
        style={{
          width: size,
          height: size,
          filter: isCritical ? `drop-shadow(0 0 4px var(--data-p0))` : undefined,
        }}
        title={`SLA consumido: ${rounded}%`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          className="-rotate-90"
          role="img"
          aria-label={`SLA consumido: ${rounded}%`}
        >
          <circle cx={center} cy={center} r={RADIUS} fill="none" strokeWidth={STROKE} style={{ stroke: "var(--line-strong)" }} />
          <circle
            cx={center}
            cy={center}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ stroke: color, transition: "stroke-dashoffset 600ms ease-out, stroke 300ms ease-out" }}
          />
        </svg>
        <span
          className="mono-label absolute inset-0 flex items-center justify-center text-[9px] font-semibold"
          style={{ color, letterSpacing: 0 }}
        >
          {rounded}%
        </span>
        {isCritical && (
          <span
            className="sla-blink absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
            style={{ background: color }}
          />
        )}
      </div>
      <span className="mono-label text-[7px] leading-none text-[color:var(--muted-2)]">SLA</span>
    </div>
  );
}
