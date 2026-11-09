import { QueueTreeSelect } from "./QueueTreeSelect";
import { priorityTint } from "../lib/priorityTint";
import { ZnunyStats } from "../lib/znunyStats";
import { Catalog } from "../types";

interface KpiDockProps {
  stats: ZnunyStats;
  catalog: Catalog;
  queue: string | null;
  onQueueChange: (queue: string | null) => void;
  isPending?: boolean;
}

const TREND_WINDOW = 30;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function KpiDock({ stats, catalog, queue, onQueueChange, isPending = false }: KpiDockProps) {
  const topName = catalog.priorities.find((p) => p.id === catalog.topPriorityId)?.name ?? "Prioridad máxima";
  // stats.trend ya cubre los últimos 30 días calendario de El Salvador.
  const trendTotal = stats.trend.slice(-TREND_WINDOW).reduce((acc, p) => acc + p.count, 0);
  const items: { label: string; value: number; color?: string; alarm?: boolean; hint?: string }[] = [
    { label: "Abiertos", value: stats.totalOpen },
    {
      label: `${capitalize(topName)} abiertos`,
      value: stats.topPriorityOpen,
      color: stats.topPriorityOpen > 0 ? "var(--data-p0)" : undefined,
      alarm: stats.topPriorityOpen > 0,
    },
    { label: "Cerrados hoy", value: stats.closedToday },
    {
      label: `Tendencia (${TREND_WINDOW} d)`,
      value: trendTotal,
      hint: "tickets creados",
    },
  ];

  return (
    <div className="hud-scale fixed left-5 top-[78px] z-10 flex w-[190px] flex-col gap-2">
      <div className="relative z-20 rounded-panel glass px-3.5 py-3">
        <div className="flex items-center justify-between">
          <p className="mono-label text-[11px] tracking-[0.12em] text-text-label">Cola</p>
          {/* Mismo texto/estilo que el "Cargando dashboard..." de App.tsx durante la carga inicial. */}
          {isPending && (
            <p className="mono-label text-[11px] tracking-[0.12em] text-text-label">Cargando...</p>
          )}
        </div>
        <QueueTreeSelect className="mt-1.5" queues={catalog.queues} value={queue} onChange={onQueueChange} />
      </div>
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-panel glass px-3.5 py-3 transition-opacity duration-200 ${
            isPending ? "opacity-50" : "opacity-100"
          }`}
          style={
            item.alarm
              ? {
                  backgroundImage: priorityTint(0, "card"),
                  boxShadow: "var(--glass-edge), var(--glass-shadow), var(--glow-critical)",
                }
              : undefined
          }
        >
          <p className="mono-label text-[11px] tracking-[0.12em] text-text-label">{item.label}</p>
          <p
            className="mt-0.5 text-[30px] font-bold leading-tight text-text-strong"
            style={item.color ? { color: item.color } : undefined}
          >
            {item.value}
          </p>
          {item.hint && <p className="mono-label text-[11px] text-text-label">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}
