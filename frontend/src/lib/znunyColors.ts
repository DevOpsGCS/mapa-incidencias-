import { StateType } from "../types";
import { PRIORITY_HEX, STATE_SHADES_HEX, STATE_TYPE_HEX } from "./dataColors";

export type SiteSeverity = "idle" | "warning" | "urgente";

export function isOpenStateType(t: StateType): boolean {
  return t === "new" || t === "open" || t === "pending";
}

export function stateTypeColor(t: StateType): string {
  return STATE_TYPE_HEX[t];
}

/**
 * Color de cada estado por NOMBRE: dentro de su tipo, los estados se ordenan
 * por id (el estándar de Znuny, de id más bajo, conserva el color del tipo) y
 * toman los tonos de STATE_SHADES_HEX en orden (si sobran estados, se repiten).
 * Sale del catálogo en vivo: nunca una lista fija de nombres.
 */
export function buildStateColorMap(states: { id: number; name: string; type: StateType }[]): Map<string, string> {
  const map = new Map<string, string>();
  const byType = new Map<StateType, { id: number; name: string }[]>();
  for (const s of states) {
    const list = byType.get(s.type) ?? [];
    list.push(s);
    byType.set(s.type, list);
  }
  for (const [type, list] of byType) {
    const shades = STATE_SHADES_HEX[type] ?? [STATE_TYPE_HEX.open];
    [...list].sort((a, b) => a.id - b.id).forEach((s, i) => map.set(s.name, shades[i % shades.length]));
  }
  return map;
}

/** Color del estado; si no está en el catálogo (estado nuevo aún no cargado), el de su tipo. */
export function stateColor(colors: Map<string, string>, name: string, type: StateType): string {
  return colors.get(name) ?? STATE_TYPE_HEX[type];
}

/** rank 0 = la prioridad más alta. */
export function priorityColor(rank: number): string {
  if (Number.isNaN(rank)) return PRIORITY_HEX[3];
  if (rank <= 0) return PRIORITY_HEX[0];
  return PRIORITY_HEX[Math.min(Math.floor(rank), 3)];
}

export function siteSeverity(stat: { open: number; topPriorityOpen: number }): SiteSeverity {
  if (stat.topPriorityOpen > 0) return "urgente";
  if (stat.open > 0) return "warning";
  return "idle";
}
