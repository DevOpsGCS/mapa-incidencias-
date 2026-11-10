import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { SlaRing } from "./SlaRing";
import { TicketDetail } from "./TicketDetail";
import { buildPriorityRankMap, UNKNOWN_PRIORITY_RANK } from "../lib/priorityRank";
import { SITE_TYPE_LABELS } from "../lib/labels";
import { priorityTextColor, priorityTint, SELECTION_STYLE_INSET } from "../lib/priorityTint";
import { computeSlaPercentage } from "../lib/sla";
import { formatAge, panelHeights, pickSelected, queueLabel } from "../lib/sitePanel";
import { buildStateColorMap, isOpenStateType, stateColor } from "../lib/znunyColors";
import { Catalog, Site, StateType, Ticket } from "../types";

interface SitePanelProps {
  site: Site | null;
  tickets: Ticket[];
  catalog: Catalog;
  onClose: () => void;
}

const STATE_TYPE_ORDER: Record<StateType, number> = { new: 0, open: 1, pending: 2, closed: 3 };
// Grupos visuales de las pastillas de estado (separados por una línea): abiertos → pendientes → cerrados.
const STATE_GROUP: Record<StateType, number> = { new: 0, open: 0, pending: 1, closed: 2 };

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("es") + text.slice(1);
}

// Alturas en px (nunca "auto"/vh puro): animar la altura solo funciona suave
// entre dos números concretos, así que se calculan en lib/sitePanel y se aplican inline.
const MIN_DRAG_HEIGHT = 120; // piso visual mientras se arrastra hacia abajo
const CLOSE_HEIGHT_THRESHOLD = 160; // al soltar por debajo de esto, cierra
const EXPAND_MARGIN = 40; // al soltar 40 px por encima de la altura inicial, queda expandida

/** Factor de zoom de `.hud-scale` (TV); las alturas inline del panel se multiplican por él. */
function hudZoom(): number {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hud-zoom"));
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/** Mide el viewport y el dock de KPIs (una sola vez por apertura/resize, no por render). */
function measureHeights(): { compact: number; expanded: number; zoom: number } {
  if (typeof window === "undefined") return { compact: 300, expanded: 300, zoom: 1 };
  const zoom = hudZoom();
  const dock = document.querySelector("[data-kpi-dock]");
  const kpiBottomPx = dock ? dock.getBoundingClientRect().bottom : null;
  return { ...panelHeights({ innerHeight: window.innerHeight, zoom, kpiBottomPx }), zoom };
}

export function SitePanel({ site, tickets, catalog, onClose }: SitePanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  // Se mide al abrir (cambio de sitio) y al redimensionar la ventana (y por tanto el zoom de la TV),
  // nunca en cada render: durante el arrastre getBoundingClientRect forzaría reflows.
  const [measured, setMeasured] = useState(measureHeights);
  const siteId = site?.id;
  useEffect(() => {
    setMeasured(measureHeights());
  }, [siteId]);
  useEffect(() => {
    const onResize = () => setMeasured(measureHeights());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const compactHeight = measured.compact;
  const dragStartHeight = useRef(compactHeight);

  useEffect(() => {
    setStatusFilter("all");
    setSelectedId(null);
    setExpanded(false);
  }, [site?.id]);

  const rankById = useMemo(() => buildPriorityRankMap(catalog), [catalog]);
  const stateColors = useMemo(() => buildStateColorMap(catalog.states), [catalog]);

  const allSiteTickets = useMemo(
    () => (site ? tickets.filter((t) => t.siteId === site.id) : []),
    [tickets, site]
  );

  // Píldoras de estado con los nombres reales presentes en este sitio, con conteo.
  const stateChips = useMemo(() => {
    const byName = new Map<string, { type: StateType; count: number }>();
    allSiteTickets.forEach((t) => {
      const prev = byName.get(t.state);
      byName.set(t.state, { type: t.stateType, count: (prev?.count ?? 0) + 1 });
    });
    return Array.from(byName, ([name, v]) => ({ name, ...v })).sort(
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

  // Se recalcula al cambiar sitio, filtro o selección: nunca queda el ticket del filtro anterior.
  const selected = useMemo(() => pickSelected(siteTickets, selectedId), [siteTickets, selectedId]);

  const now = new Date();

  const expandedHeight = measured.expanded;
  const restingHeight = expanded ? expandedHeight : compactHeight;
  const liveHeight = dragging
    ? Math.min(Math.max(dragStartHeight.current - dragY, MIN_DRAG_HEIGHT), expandedHeight)
    : restingHeight;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Evita la selección de texto nativa, que compite con el gesto de arrastre.
    event.preventDefault();
    dragStartY.current = event.clientY;
    dragStartHeight.current = restingHeight;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    // El delta es en px de pantalla; las alturas son locales (multiplicadas por el zoom).
    setDragY((event.clientY - dragStartY.current) / measured.zoom);
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
      setExpanded(finalHeight >= compactHeight + EXPAND_MARGIN);
    }
  };

  if (!site) return null;

  const pillClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors ${
      active ? "bg-accent-fill font-semibold text-white" : "bg-surface-2 text-text hover:text-text-strong"
    }`;
  const pillStyle = (active: boolean) => (active ? { boxShadow: "var(--glow-select)" } : undefined);
  const separator = (key: string) => (
    <span key={key} aria-hidden className="mx-1 h-[18px] w-px bg-line-control" />
  );

  return (
    <div
      className="hud-scale fixed bottom-5 left-5 right-[320px] z-[15] flex flex-col overflow-hidden rounded-panel glass px-5 pb-4 pt-1"
      style={{
        height: `${liveHeight}px`,
        transition: dragging ? "none" : "height 200ms ease-out",
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
          <span className="h-1.5 w-12 rounded-full bg-line-control" />
        </div>

        <div className="mb-3 flex items-center justify-between gap-4 px-5">
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-text-strong">{site.name}</p>
            <p className="mono-label text-xs text-text-label">
              {SITE_TYPE_LABELS[site.type]} · {openCount} abiertos
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              onPointerDown={(event) => event.stopPropagation()}
              className={pillClass(statusFilter === "all")}
              style={pillStyle(statusFilter === "all")}
            >
              Todos <span className="mono-label opacity-80">{allSiteTickets.length}</span>
            </button>
            {stateChips.flatMap((chip, index) => {
              const active = statusFilter === chip.name;
              const startsGroup =
                index === 0 || STATE_GROUP[stateChips[index - 1].type] !== STATE_GROUP[chip.type];
              const pill = (
                <button
                  key={chip.name}
                  type="button"
                  onClick={() => setStatusFilter(chip.name)}
                  onPointerDown={(event) => event.stopPropagation()}
                  className={pillClass(active)}
                  style={pillStyle(active)}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: stateColor(stateColors, chip.name, chip.type) }}
                  />
                  {capitalize(chip.name)} <span className="mono-label opacity-80">{chip.count}</span>
                </button>
              );
              return startsGroup ? [separator(`sep-${chip.name}`), pill] : [pill];
            })}
            <button
              type="button"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              className="ml-2 flex-shrink-0 rounded-full bg-surface-2 px-3 py-1 text-xs text-text transition-colors hover:text-text-strong"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{ gridTemplateColumns: siteTickets.length === 0 ? "1fr" : "3fr 2fr" }}
      >
        <div className="site-list thin-scroll min-h-0 overflow-y-auto">
          {siteTickets.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">Sin tickets con este filtro</p>
          ) : (
            siteTickets.map((ticket) => {
              const rank = rankById.get(ticket.priorityId) ?? UNKNOWN_PRIORITY_RANK;
              const isSelected = selected?.id === ticket.id;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(ticket.id)}
                  className={`site-row mb-1 grid h-[52px] w-full items-center gap-3 rounded-lg px-3 text-left ${
                    isSelected ? "" : "hover:bg-surface-2"
                  }`}
                  style={{
                    ...(isSelected ? SELECTION_STYLE_INSET : { backgroundImage: priorityTint(rank, "row") }),
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-text-strong">{ticket.title}</span>
                    <span className="mono-label block truncate text-[11px] text-text-label">
                      {ticket.tn} · {formatAge(ticket.createdAt, now)} ·{" "}
                      <span style={{ color: priorityTextColor(rank) }}>{ticket.priority}</span>
                    </span>
                  </span>
                  <span className="truncate text-xs text-text-muted">{queueLabel(ticket.queue)}</span>
                  <span className="site-row-owner truncate text-xs text-text-muted">{ticket.owner}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-text">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: stateColor(stateColors, ticket.state, ticket.stateType) }}
                      aria-hidden
                    />
                    <span className="truncate">{ticket.state}</span>
                  </span>
                  <span className="flex justify-center">
                    <SlaRing percentage={computeSlaPercentage(ticket)} size={30} />
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Con la lista vacía el aviso ya está a la izquierda: el detalle no lo repite. */}
        {siteTickets.length > 0 && (
          <div className="min-h-0 overflow-hidden rounded-xl bg-surface-2">
            <TicketDetail ticket={selected} catalog={catalog} />
          </div>
        )}
      </div>
    </div>
  );
}
