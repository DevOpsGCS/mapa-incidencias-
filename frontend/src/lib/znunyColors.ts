import { StateType } from "../types";
import { PRIORITY_HEX, STATE_TYPE_HEX } from "./dataColors";

export type SiteSeverity = "idle" | "warning" | "urgente";

export function isOpenStateType(t: StateType): boolean {
  return t === "new" || t === "open" || t === "pending";
}

export function stateTypeColor(t: StateType): string {
  return STATE_TYPE_HEX[t];
}

/** rank 0 = la prioridad más alta. */
export function priorityColor(rank: number): string {
  if (!Number.isFinite(rank) || rank <= 0) return PRIORITY_HEX[0];
  return PRIORITY_HEX[Math.min(Math.floor(rank), 3)];
}

export function siteSeverity(stat: { open: number; topPriorityOpen: number }): SiteSeverity {
  if (stat.topPriorityOpen > 0) return "urgente";
  if (stat.open > 0) return "warning";
  return "idle";
}
