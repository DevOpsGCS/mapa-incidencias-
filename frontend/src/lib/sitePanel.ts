import { Ticket } from "../types";
import { isOpenStateType } from "./znunyColors";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Antigüedad legible: "hace 5 min", "hace 3 h", "hace 2 d". */
export function formatAge(createdIso: string, now: Date): string {
  const diff = Math.max(0, now.getTime() - new Date(createdIso).getTime());
  if (diff >= DAY) return `hace ${Math.floor(diff / DAY)} d`;
  if (diff >= HOUR) return `hace ${Math.floor(diff / HOUR)} h`;
  return `hace ${Math.floor(diff / MINUTE)} min`;
}

/** "A::B" -> "A › B". */
export function queueLabel(queue: string): string {
  return queue.split("::").join(" › ");
}

/** Ticket mostrado en el detalle: el seleccionado si sigue visible; si no, el primer ticket abierto (o el primero si no hay); vacío -> null. */
export function pickSelected(visible: Ticket[], selectedId: number | null): Ticket | null {
  if (visible.length === 0) return null;
  return visible.find((t) => t.id === selectedId) ?? visible.find((t) => isOpenStateType(t.stateType)) ?? visible[0];
}

// Constantes en px locales (dentro de `.hud-scale`, que aplica CSS zoom).
export const TOPBAR_OFFSET = 78;
export const PANEL_BOTTOM_OFFSET = 20;
const INITIAL_VH = 0.38;
// La altura compacta no debe tapar la última tarjeta de KPIs: el borde inferior del dock se mide
// en vivo (`data-kpi-dock`); KPI_STACK_BOTTOM es solo el respaldo (ya en px locales).
const KPI_STACK_BOTTOM = 520;
const KPI_CLEARANCE = 12;
const MIN_COMPACT_HEIGHT = 200;

export interface PanelHeightsInput {
  /** window.innerHeight (px de pantalla). */
  innerHeight: number;
  /** Factor de zoom de `.hud-scale`. */
  zoom: number;
  /** Borde inferior del dock de KPIs en px de pantalla, o null si no se pudo medir. */
  kpiBottomPx: number | null;
}

/** Alturas del panel en px locales (ya divididos por el zoom): compacta y expandida. */
export function panelHeights({ innerHeight, zoom, kpiBottomPx }: PanelHeightsInput): {
  compact: number;
  expanded: number;
} {
  const viewport = innerHeight / zoom;
  const kpiBottom = kpiBottomPx === null ? KPI_STACK_BOTTOM : kpiBottomPx / zoom;
  const byRatio = Math.round(viewport * INITIAL_VH);
  const belowKpis = Math.floor(viewport - kpiBottom - PANEL_BOTTOM_OFFSET - KPI_CLEARANCE);
  return {
    compact: Math.max(MIN_COMPACT_HEIGHT, Math.min(byRatio, belowKpis)),
    expanded: viewport - TOPBAR_OFFSET - PANEL_BOTTOM_OFFSET,
  };
}
