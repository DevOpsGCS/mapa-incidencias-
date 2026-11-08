import { QueueTreeSelect } from "./QueueTreeSelect";
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
  const items: { label: string; value: number; color: string; alarm?: boolean; hint?: string }[] = [
    { label: "Abiertos", value: stats.totalOpen, color: "var(--blue)" },
    {
      label: `${capitalize(topName)} abiertos`,
      value: stats.topPriorityOpen,
      color: "var(--red)",
      alarm: stats.topPriorityOpen > 0,
    },
    { label: "Cerrados hoy", value: stats.closedToday, color: "var(--green)" },
    {
      label: `Tendencia (${TREND_WINDOW} d)`,
      value: trendTotal,
      color: "var(--cyan)",
      hint: "tickets creados",
    },
  ];

  return (
    <div className="hud-scale fixed left-5 top-[78px] z-10 flex w-[190px] flex-col gap-2">
      <div className="glass-panel px-3.5 py-3">
        <div className="flex items-center justify-between">
          <p className="mono-label text-[10px] text-[color:var(--muted)]">Cola</p>
          {/* Mismo texto/estilo que el "Cargando dashboard..." de App.tsx durante la carga inicial. */}
          {isPending && (
            <p className="mono-label text-[10px] text-[color:var(--muted)]">Cargando...</p>
          )}
        </div>
        <QueueTreeSelect className="mt-1.5" queues={catalog.queues} value={queue} onChange={onQueueChange} />
      </div>
      {items.map((item) => (
        <div
          key={item.label}
          className={`glass-panel px-3.5 py-3 transition-opacity duration-200 ${
            item.alarm ? "urgente-alarm" : ""
          } ${isPending ? "opacity-50" : "opacity-100"}`}
        >
          <p className="mono-label text-[10px] text-[color:var(--muted)]">{item.label}</p>
          <p
            className="font-display mt-0.5 text-2xl font-semibold"
            style={{ color: item.color }}
          >
            {item.value}
          </p>
          {item.hint && <p className="mono-label text-[9px] text-[color:var(--muted-2)]">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}
