import { ServiceDeskLink } from "./ServiceDeskLink";
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { SlaRing } from "./SlaRing";
import { buildPriorityRankMap, UNKNOWN_PRIORITY_RANK } from "../lib/priorityRank";
import { QueueIcon } from "../lib/queueIcons";
import { SITE_TYPE_LABELS } from "../lib/labels";
import { computeSlaPercentage } from "../lib/sla";
import { formatSvDateTime } from "../lib/svTime";
import { isOpenStateType, priorityColor } from "../lib/znunyColors";
import { Catalog, Site, StateType, Ticket } from "../types";

interface DetailDrawerProps {
  site: Site | null;
  tickets: Ticket[];
  catalog: Catalog;
  onClose: () => void;
}

const STATE_TYPE_ORDER: Record<StateType, number> = { new: 0, open: 1, pending: 2, closed: 3 };

// Alturas en px (nunca "auto"/vh puro): animar max-height solo funciona suave
// entre dos números concretos, así que se calculan acá y se aplican inline.
const COMPACT_HEIGHT = 300;
// Mismo criterio que SiteRail/KpiDock (top-[78px]) + el bottom-5 (20px) del
// propio panel: expandida ocupa TODO el espacio libre debajo del TopBar.
const TOPBAR_OFFSET = 78;
const PANEL_BOTTOM_OFFSET = 20;
const MIN_DRAG_HEIGHT = 120; // piso visual mientras se arrastra hacia abajo
const CLOSE_HEIGHT_THRESHOLD = 160; // al soltar por debajo de esto, cierra
const EXPAND_HEIGHT_THRESHOLD = COMPACT_HEIGHT + 40; // al soltar por encima de esto, queda expandida

export function DetailDrawer({ site, tickets, catalog, onClose }: DetailDrawerProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef(COMPACT_HEIGHT);

  useEffect(() => {
    setStatusFilter("all");
    setExpanded(false);
  }, [site?.id]);

  const rankById = useMemo(() => buildPriorityRankMap(catalog), [catalog]);

  const allSiteTickets = useMemo(
    () => (site ? tickets.filter((t) => t.siteId === site.id) : []),
    [tickets, site]
  );

  // Chips de estado con los nombres reales de Znuny presentes en este sitio.
  const stateChips = useMemo(() => {
    const byName = new Map<string, StateType>();
    allSiteTickets.forEach((t) => byName.set(t.state, t.stateType));
    return Array.from(byName, ([name, type]) => ({ name, type })).sort(
      (a, b) => STATE_TYPE_ORDER[a.type] - STATE_TYPE_ORDER[b.type] || a.name.localeCompare(b.name)
    );
  }, [allSiteTickets]);

  const siteTickets = useMemo(
    () => (statusFilter === "all" ? allSiteTickets : allSiteTickets.filter((t) => t.state === statusFilter)),
    [allSiteTickets, statusFilter]
  );

  const openCount = useMemo(
    () => allSiteTickets.filter((t) => isOpenStateType(t.stateType)).length,
    [allSiteTickets]
  );

  const expandedHeight =
    typeof window !== "undefined"
      ? window.innerHeight - TOPBAR_OFFSET - PANEL_BOTTOM_OFFSET
      : COMPACT_HEIGHT;
  const restingHeight = expanded ? expandedHeight : COMPACT_HEIGHT;
  const liveHeight = dragging
    ? Math.min(Math.max(dragStartHeight.current - dragY, MIN_DRAG_HEIGHT), expandedHeight)
    : restingHeight;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Sin esto, arrastrar con mouse sobre el nombre del sitio o los filtros
    // dispara la selección de texto nativa del navegador (el resaltado azul),
    // que compite con el gesto y lo corta a mitad de camino.
    event.preventDefault();
    dragStartY.current = event.clientY;
    dragStartHeight.current = restingHeight;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    setDragY(event.clientY - dragStartY.current);
  };

  const endDrag = () => {
    if (dragStartY.current === null) return;
    const finalHeight = liveHeight;
    dragStartY.current = null;
    setDragging(false);
    setDragY(0);

    if (finalHeight <= CLOSE_HEIGHT_THRESHOLD) {
      onClose();
    } else {
      setExpanded(finalHeight >= EXPAND_HEIGHT_THRESHOLD);
    }
  };

  if (!site) return null;

  return (
    <div
      className="hud-scale glass-panel fixed bottom-5 left-5 right-[320px] z-[15] flex flex-col overflow-hidden px-5 pb-4 pt-1"
      style={{
        maxHeight: `${liveHeight}px`,
        transition: dragging ? "none" : "max-height 200ms ease-out",
      }}
    >
      <div
        className="-mx-5 -mt-1 flex shrink-0 cursor-grab touch-none select-none flex-col active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label="Deslizar para expandir o cerrar"
        role="separator"
      >
        <div className="flex justify-center py-2.5">
          <span className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        <div className="mb-3 flex items-baseline justify-between gap-3 px-5">
          <div className="min-w-0">
            <p className="font-display truncate text-lg font-semibold text-[color:var(--text)]">
              {site.name}
            </p>
            <p className="mono-label text-[10.5px] text-[color:var(--muted)]">
              {SITE_TYPE_LABELS[site.type].toUpperCase()} · {openCount} TICKETS ABIERTOS
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex-shrink-0 rounded-md border border-[color:var(--glass-border)] px-2.5 py-1 text-[11px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
          >
            Cerrar
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1 px-5">
          {["all", ...stateChips.map((chip) => chip.name)].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              onPointerDown={(event) => event.stopPropagation()}
              className={`mono-label rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                statusFilter === status
                  ? "bg-[#1A294C] text-[#7099FF]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
              }`}
            >
              {status === "all" ? "TODOS" : status.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="thin-scroll grid min-h-0 flex-1 grid-cols-1 gap-2.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {siteTickets.length === 0 ? (
          <p className="col-span-full py-6 text-center text-sm text-[color:var(--muted)]">
            No hay tickets para este filtro.
          </p>
        ) : (
          siteTickets.map((ticket) => {
            const color = priorityColor(rankById.get(ticket.priorityId) ?? UNKNOWN_PRIORITY_RANK);
            const slaPct = computeSlaPercentage(ticket);
            return (
              <div
                key={ticket.id}
                className="relative rounded-r-lg border border-[color:var(--glass-border)] border-l-[3px] bg-white/[0.03] px-3 py-2.5"
                style={{ borderLeftColor: color }}
              >
                {/* Absoluto a propósito: el anillo (42px + etiqueta "SLA") es
                    más alto que una sola línea de título — si compartiera fila
                    flex con el texto, la altura de la fila quedaba fijada por
                    el anillo y el resto de la tarjeta se corría más abajo de
                    lo necesario cuando el título era corto. */}
                <div className="absolute right-2 top-2">
                  <SlaRing percentage={slaPct} />
                </div>
                <div className="min-w-0 pr-11">
                  <p className="line-clamp-2 text-xs text-[color:var(--text)]">
                    <span className="font-mono text-[color:var(--muted)]">{ticket.tn}</span> · {ticket.title}
                  </p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className="mono-label rounded px-1.5 py-0.5 text-[9px] font-semibold"
                    style={{ color, background: `${color}26`, boxShadow: `inset 0 0 0 1px ${color}4D` }}
                  >
                    {ticket.priority.toUpperCase()}
                  </span>
                  <span className="mono-label rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-[color:var(--muted)]">
                    {ticket.state.toUpperCase()}
                  </span>
                  <p className="mono-label flex items-center gap-1 text-[9.5px] text-[color:var(--muted)]">
                    <QueueIcon queue={ticket.queue} size={11} />
                    {ticket.queue}
                  </p>
                </div>
                <p className="mono-label mt-1 truncate text-[9px] text-[color:var(--muted-2)]">
                  Tipo: {ticket.type ?? "—"} · Servicio: {ticket.service ?? "—"} · SLA: {ticket.sla ?? "—"}
                </p>
                <p className="mono-label truncate text-[9px] text-[color:var(--muted-2)]">
                  Propietario: {ticket.owner} · Responsable: {ticket.responsible ?? "—"} · Cliente: {ticket.customer}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="mono-label text-[9px] text-[color:var(--muted-2)]">
                    {formatSvDateTime(ticket.createdAt)}
                  </span>
                  <ServiceDeskLink href={ticket.znunyUrl} variant="short" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
