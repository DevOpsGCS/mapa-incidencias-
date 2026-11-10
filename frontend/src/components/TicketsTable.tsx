import { IconColumns3, IconPlus, IconSearch } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { QueueTreeSelect } from "./QueueTreeSelect";
import { SidePanel } from "./SidePanel";
import { SlaBar } from "./SlaBar";
import { TicketDetail } from "./TicketDetail";
import { TicketTitleLink } from "./TicketTitleLink";
import { buildPriorityRankMap, UNKNOWN_PRIORITY_RANK } from "../lib/priorityRank";
import { priorityColor, stateTypeColor } from "../lib/znunyColors";
import { priorityTint, SELECTION_STYLE_INSET } from "../lib/priorityTint";
import { matchesQueueFilter } from "../lib/queueFilter";
import { QueueIcon } from "../lib/queueIcons";
import { queueLabel } from "../lib/sitePanel";
import { computeSlaPercentage } from "../lib/sla";
import { formatSvDateTime } from "../lib/svTime";
import { ALL_COLUMNS, ColumnId, COLUMN_LABELS, loadColumns, saveColumns } from "../lib/tableColumns";
import { matchesSearch } from "../lib/ticketSearch";
import { createdInRange, DateRange } from "../lib/znunyStats";
import { Catalog, StateType, Ticket } from "../types";

export interface TableExternalFilter {
  stateType?: StateType;
  createdInRangeOnly?: boolean;
}

interface TicketsTableProps {
  tickets: Ticket[];
  catalog: Catalog;
  range: DateRange;
  /** Filtro que viene de "Ver detalles" de los gráficos. */
  externalFilter?: TableExternalFilter | null;
  onClearExternalFilter?: () => void;
  /** Se publican las filas filtradas y columnas visibles para "Exportar CSV". */
  onExportDataChange?: (data: { rows: Ticket[]; columns: ColumnId[] }) => void;
}

const PAGE_SIZE = 25;

const STATE_TYPE_LABEL: Record<StateType, string> = {
  new: "Nuevo",
  open: "Abierto",
  pending: "Pendiente",
  closed: "Cerrado",
};

const controlClasses =
  "rounded-md bg-surface-2 px-2 py-1.5 text-xs text-text-strong outline-none focus:ring-1 focus:ring-accent";
const buttonClasses =
  "inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-text-strong hover:bg-surface-3";

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function TicketsTable({
  tickets,
  catalog,
  range,
  externalFilter = null,
  onClearExternalFilter,
  onExportDataChange,
}: TicketsTableProps) {
  const [siteId, setSiteId] = useState<string>("all");
  const [state, setState] = useState<string>("all");
  const [priorityId, setPriorityId] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [service, setService] = useState<string>("all");
  const [queue, setQueue] = useState<string | null>(null);
  const [owner, setOwner] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnId[]>(() => loadColumns(safeLocalStorage()));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  const rankById = useMemo(() => buildPriorityRankMap(catalog), [catalog]);

  // Sitios presentes en los tickets (nunca una lista aparte): clave = siteId o la clave cruda.
  const siteOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tickets) {
      const key = t.siteId || t.siteKey || "";
      if (key) map.set(key, t.siteName ?? t.siteKey ?? key);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tickets]);

  // Cola -> propietario es una cascada real de los DATOS: las opciones de
  // propietario son los owners de los tickets que pasan el filtro de cola.
  // Estado/prioridad/tipo/servicio salen del catálogo en vivo (nunca listas fijas).
  const owners = useMemo(() => {
    const scoped = tickets.filter((t) => matchesQueueFilter(t.queue, queue));
    return Array.from(new Set(scoped.map((t) => t.owner))).sort((a, b) => a.localeCompare(b));
  }, [tickets, queue]);

  const filtered = useMemo(() => {
    const inRange = externalFilter?.createdInRangeOnly
      ? new Set(createdInRange(tickets, range, new Date()).map((t) => t.id))
      : null;
    return tickets
      .filter((t) => (siteId === "all" ? true : (t.siteId || t.siteKey || "") === siteId))
      .filter((t) => matchesQueueFilter(t.queue, queue))
      .filter((t) => (owner === "all" ? true : t.owner === owner))
      .filter((t) => (state === "all" ? true : t.state === state))
      .filter((t) => (priorityId === "all" ? true : t.priorityId === Number(priorityId)))
      .filter((t) => (type === "all" ? true : t.type === type))
      .filter((t) => (service === "all" ? true : t.service === service))
      .filter((t) => (externalFilter?.stateType ? t.stateType === externalFilter.stateType : true))
      .filter((t) => (inRange ? inRange.has(t.id) : true))
      .filter((t) => matchesSearch(t, search))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tickets, siteId, queue, owner, state, priorityId, type, service, search, externalFilter, range]);

  // Columnas visibles en el orden canónico.
  const visibleColumns = useMemo(() => ALL_COLUMNS.filter((c) => columns.includes(c)), [columns]);

  useEffect(() => {
    onExportDataChange?.({ rows: filtered, columns: visibleColumns });
  }, [filtered, visibleColumns, onExportDataChange]);

  // Un filtro externo nuevo reinicia la paginación.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [externalFilter]);

  useEffect(() => {
    if (!columnsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [columnsOpen]);

  const visible = filtered.slice(0, visibleCount);
  const selected = selectedId === null ? null : (tickets.find((t) => t.id === selectedId) ?? null);

  const onFilter = (apply: () => void) => {
    apply();
    setVisibleCount(PAGE_SIZE);
  };

  const hasActiveFilters =
    siteId !== "all" ||
    state !== "all" ||
    priorityId !== "all" ||
    type !== "all" ||
    service !== "all" ||
    queue !== null ||
    owner !== "all" ||
    search.trim() !== "" ||
    Boolean(externalFilter?.stateType || externalFilter?.createdInRangeOnly);

  const clearFilters = () => {
    setSiteId("all");
    setState("all");
    setPriorityId("all");
    setType("all");
    setService("all");
    setQueue(null);
    setOwner("all");
    setSearch("");
    setVisibleCount(PAGE_SIZE);
    onClearExternalFilter?.();
  };

  const toggleColumn = (id: ColumnId) => {
    if (id === "title") return; // el título nunca se oculta
    const next = columns.includes(id) ? columns.filter((c) => c !== id) : [...columns, id];
    setColumns(next);
    saveColumns(safeLocalStorage(), next);
  };

  const renderCell = (ticket: Ticket, col: ColumnId) => {
    const muted = "text-text-muted";
    switch (col) {
      case "tn":
        return (
          <td key={col} className="whitespace-nowrap px-3 font-mono text-xs">
            <a
              href={ticket.znunyUrl}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="text-accent-text hover:underline"
              title="Abrir en la Mesa de Servicio"
            >
              {ticket.tn}
            </a>
          </td>
        );
      case "title":
        return (
          <td key={col} className="max-w-xs truncate px-3 text-text-strong">
            <TicketTitleLink title={ticket.title} href={ticket.znunyUrl} />
          </td>
        );
      case "queue":
        return (
          <td key={col} className={`px-3 ${muted}`}>
            <span className="inline-flex items-center gap-1.5">
              <QueueIcon queue={ticket.queue} size={13} />
              {queueLabel(ticket.queue)}
            </span>
          </td>
        );
      case "state":
        return (
          <td key={col} className="min-w-[110px] px-3">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: stateTypeColor(ticket.stateType) }}
              />
              <span className={`text-[13px] ${muted}`}>{ticket.state}</span>
            </span>
          </td>
        );
      case "priority":
        return (
          <td key={col} className="min-w-[110px] px-3">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: priorityColor(rankById.get(ticket.priorityId) ?? UNKNOWN_PRIORITY_RANK) }}
              />
              <span className={`text-[13px] ${muted}`}>{ticket.priority}</span>
            </span>
          </td>
        );
      case "owner":
        return (
          <td key={col} className={`max-w-[160px] truncate px-3 ${muted}`}>
            {ticket.owner}
          </td>
        );
      case "site":
        return (
          <td key={col} className={`px-3 ${muted}`}>
            {ticket.siteName ?? ticket.siteKey ?? "—"}
          </td>
        );
      case "sla":
        return (
          <td key={col} className="px-3">
            <SlaBar percentage={computeSlaPercentage(ticket)} />
          </td>
        );
      case "created":
        return (
          <td key={col} className={`whitespace-nowrap px-3 font-mono text-xs ${muted}`}>
            {formatSvDateTime(ticket.createdAt)}
          </td>
        );
      case "type":
        return (
          <td key={col} className={`px-3 ${muted}`}>
            {ticket.type ?? "—"}
          </td>
        );
      case "service":
        return (
          <td key={col} className={`px-3 ${muted}`}>
            {ticket.service ?? "—"}
          </td>
        );
      case "responsible":
        return (
          <td key={col} className={`px-3 ${muted}`}>
            {ticket.responsible ?? "—"}
          </td>
        );
      case "customer":
        return (
          <td key={col} className={`max-w-[160px] truncate px-3 ${muted}`}>
            {ticket.customer}
          </td>
        );
    }
  };

  const externalLabel = externalFilter?.stateType
    ? `Estado: ${STATE_TYPE_LABEL[externalFilter.stateType]}`
    : externalFilter?.createdInRangeOnly
      ? `Creados en los últimos ${range} días`
      : null;

  return (
    <div className="rounded-card glass">
      <div className="flex items-baseline gap-2 px-4 pt-3">
        <h3 className="text-sm font-bold text-text-strong">Tickets</h3>
        <span className="text-xs text-text-muted">
          {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3">
        <QueueTreeSelect
          className="w-44"
          queues={catalog.queues}
          value={queue}
          onChange={(next) =>
            onFilter(() => {
              setQueue(next);
              // Cambiar la cola resetea el propietario: sus opciones salen de
              // la cola elegida, una selección vieja dejaría un filtro "fantasma".
              setOwner("all");
            })
          }
        />

        <select
          value={priorityId}
          onChange={(event) => onFilter(() => setPriorityId(event.target.value))}
          aria-label="Prioridad"
          className={controlClasses}
        >
          <option value="all">Todas las prioridades</option>
          {[...catalog.priorities]
            .sort((a, b) => a.rank - b.rank)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>

        <select
          value={state}
          onChange={(event) => onFilter(() => setState(event.target.value))}
          aria-label="Estado"
          className={controlClasses}
        >
          <option value="all">Todos los estados</option>
          {catalog.states.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={owner}
          onChange={(event) => onFilter(() => setOwner(event.target.value))}
          aria-label="Propietario"
          className={controlClasses}
        >
          <option value="all">Todos los propietarios</option>
          {owners.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className={buttonClasses}
        >
          <IconPlus size={14} stroke={2} />
          Más filtros
        </button>

        <div ref={columnsRef} className="relative">
          <button
            type="button"
            onClick={() => setColumnsOpen((v) => !v)}
            aria-expanded={columnsOpen}
            className={buttonClasses}
          >
            <IconColumns3 size={14} stroke={2} />
            Columnas
          </button>
          {columnsOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-md bg-surface-2 py-1 shadow-2xl">
              {ALL_COLUMNS.map((id) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-3"
                >
                  <input
                    type="checkbox"
                    checked={columns.includes(id)}
                    disabled={id === "title"}
                    onChange={() => toggleColumn(id)}
                  />
                  {COLUMN_LABELS[id]}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="relative ml-auto">
          <IconSearch size={14} stroke={2} className="pointer-events-none absolute left-2 top-2 text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => onFilter(() => setSearch(event.target.value))}
            placeholder="Buscar por Nº o título…"
            aria-label="Buscar tickets"
            className={`${controlClasses} w-56 pl-7`}
          />
        </div>

        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="text-xs text-accent-text hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {(showMore || externalLabel) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          {showMore && (
            <>
              <select
                value={type}
                onChange={(event) => onFilter(() => setType(event.target.value))}
                aria-label="Tipo"
                className={controlClasses}
              >
                <option value="all">Todos los tipos</option>
                {catalog.types.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={service}
                onChange={(event) => onFilter(() => setService(event.target.value))}
                aria-label="Servicio"
                className={controlClasses}
              >
                <option value="all">Todos los servicios</option>
                {catalog.services.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={siteId}
                onChange={(event) => onFilter(() => setSiteId(event.target.value))}
                aria-label="Sitio"
                className={controlClasses}
              >
                <option value="all">Todos los sitios</option>
                {siteOptions.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </>
          )}
          {externalLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-xs text-text">
              {externalLabel}
              <button
                type="button"
                onClick={onClearExternalFilter}
                aria-label="Quitar filtro"
                className="text-text-muted hover:text-text-strong"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      <div className="thin-scroll max-h-[640px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-surface-1">
            <tr className="border-b border-line-strong text-[11px] uppercase text-text-label">
              {visibleColumns.map((col) => (
                <th key={col} className="px-3 py-2 font-medium" style={{ letterSpacing: "0.12em" }}>
                  {COLUMN_LABELS[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((ticket) => {
              const rank = rankById.get(ticket.priorityId) ?? UNKNOWN_PRIORITY_RANK;
              const isSelected = ticket.id === selectedId;
              return (
                <tr
                  key={ticket.id}
                  onClick={() => setSelectedId(ticket.id)}
                  className="h-11 cursor-pointer border-b border-line hover:bg-surface-2"
                  style={isSelected ? SELECTION_STYLE_INSET : { backgroundImage: priorityTint(rank, "row") }}
                >
                  {visibleColumns.map((col) => renderCell(ticket, col))}
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={Math.max(visibleColumns.length, 1)} className="px-3 py-8 text-center text-text-muted">
                  No hay tickets que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {visibleCount < filtered.length && (
        <div className="p-3 text-center">
          <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className={buttonClasses}>
            Ver más
          </button>
        </div>
      )}

      <SidePanel open={selected !== null} onClose={() => setSelectedId(null)}>
        <TicketDetail ticket={selected} catalog={catalog} />
      </SidePanel>
    </div>
  );
}
