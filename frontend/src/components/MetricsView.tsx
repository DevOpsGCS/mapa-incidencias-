import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReportCard } from "./ReportCard";
import { StatusChart } from "./StatusChart";
import { TicketsTable } from "./TicketsTable";
import { TrendChart } from "./TrendChart";
import { priorityTint } from "../lib/priorityTint";
import { ColumnId } from "../lib/tableColumns";
import { csvFileName, ticketsToCsv } from "../lib/ticketsCsv";
import { createdInRange, DateRange, trendFor, ZnunyStats } from "../lib/znunyStats";
import { Catalog, Site, StateType, Ticket } from "../types";

export interface DetailsFilter {
  stateType?: StateType;
  createdInRangeOnly?: boolean;
}

interface MetricsViewProps {
  tickets: Ticket[];
  sites: Site[];
  stats: ZnunyStats;
  catalog: Catalog;
  lastHeartbeatAt?: Date | null;
  onRefresh?: () => void;
}

const RANGE_OPTIONS: DateRange[] = [7, 30, 90];

/** "Actualizado hace N s": el tic por segundo vive aquí para no re-renderizar la tabla. */
function UpdatedAgo({ at }: { at: Date | null | undefined }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!at) return <>Esperando datos</>;
  return <>Actualizado hace {Math.max(0, Math.round((Date.now() - at.getTime()) / 1000))} s</>;
}

function PanelHeader({ title, onDetails }: { title: string; onDetails: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold text-text-strong">{title}</h3>
      <button type="button" onClick={onDetails} className="text-xs text-accent-text hover:underline">
        Ver detalles
      </button>
    </div>
  );
}

export function MetricsView({ tickets, stats, catalog, lastHeartbeatAt = null, onRefresh }: MetricsViewProps) {
  const [range, setRange] = useState<DateRange>(30);
  const tableRef = useRef<HTMLElement>(null);
  const [detailsFilter, setDetailsFilter] = useState<DetailsFilter | null>(null);
  const exportRef = useRef<{ rows: Ticket[]; columns: ColumnId[] }>({ rows: [], columns: [] });
  const onExportDataChange = useCallback((data: { rows: Ticket[]; columns: ColumnId[] }) => {
    exportRef.current = data;
  }, []);
  const clearDetailsFilter = useCallback(() => setDetailsFilter(null), []);

  const openQueues = useMemo(
    () => new Set(tickets.filter((t) => t.stateType !== "closed").map((t) => t.queue)).size,
    [tickets]
  );
  const created = useMemo(() => createdInRange(tickets, range, new Date()).length, [tickets, range]);
  const trend = useMemo(() => trendFor(tickets, range, new Date()), [tickets, range]);

  const onShowDetails = (filter: DetailsFilter) => {
    setDetailsFilter(filter);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportCsv = () => {
    const { rows, columns } = exportRef.current;
    const csv = ticketsToCsv(rows, columns, {
      siteName: (t) => t.siteName ?? t.siteKey ?? "",
      priorityName: (t) => t.priority,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFileName(new Date());
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Diferido: algunos navegadores cancelan la descarga si se revoca de inmediato.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="under-topbar thin-scroll h-full overflow-y-auto px-5 pb-6 pt-[92px]">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs text-text-label">Métricas › Resumen de tickets</div>
            <h1 className="mt-1 text-[22px] font-bold text-text-strong">Resumen de tickets</h1>
            <p className="mt-1 text-xs text-text-muted">
              <UpdatedAgo at={lastHeartbeatAt} /> · datos en vivo de la Mesa de
              Servicio
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value) as DateRange)}
              aria-label="Rango de fechas"
              className="rounded-md bg-surface-2 px-3 py-1.5 text-xs text-text-strong"
            >
              {RANGE_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  Últimos {days} días
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-md bg-surface-2 px-3 py-1.5 text-xs text-text-strong hover:bg-surface-3"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-md bg-surface-2 px-3 py-1.5 text-xs text-text-strong hover:bg-surface-3"
            >
              Actualizar
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ReportCard title="Tickets abiertos" value={stats.totalOpen} hint={`en ${openQueues} colas`} />
          <ReportCard
            title="Crítica abiertos"
            value={stats.topPriorityOpen}
            hint="prioridad máxima"
            tint={stats.topPriorityOpen > 0 ? priorityTint(0, "card") : undefined}
            critical={stats.topPriorityOpen > 0}
          />
          <ReportCard title="Cerrados hoy" value={stats.closedToday} hint="día El Salvador" />
          <ReportCard title={`Creados (${range} d)`} value={created} hint={`últimos ${range} días`} />
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-card glass p-4">
            <PanelHeader title="Tickets actuales por estado" onDetails={() => onShowDetails({})} />
            <div className="mt-2">
              <StatusChart stats={stats} onSelectState={(stateType) => onShowDetails({ stateType })} />
            </div>
          </div>
          <div className="rounded-card glass p-4">
            <PanelHeader
              title={`Tickets creados (${range} días)`}
              onDetails={() => onShowDetails({ createdInRangeOnly: true })}
            />
            <div className="mt-2">
              <TrendChart data={trend} />
            </div>
          </div>
        </section>

        <section ref={tableRef}>
          <TicketsTable
            tickets={tickets}
            catalog={catalog}
            range={range}
            externalFilter={detailsFilter}
            onClearExternalFilter={clearDetailsFilter}
            onExportDataChange={onExportDataChange}
          />
        </section>
      </div>
    </div>
  );
}
