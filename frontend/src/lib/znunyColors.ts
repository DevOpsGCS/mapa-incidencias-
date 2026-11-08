import { StateType } from "../types";

export type SiteSeverity = "idle" | "warning" | "urgente";

export function isOpenStateType(t: StateType): boolean {
  return t === "new" || t === "open" || t === "pending";
}

const STATE_TYPE_COLORS: Record<StateType, string> = {
  new: "#3ED6C4",
  open: "#4C7FFF",
  pending: "#F5A623",
  closed: "#64748B",
};

export function stateTypeColor(t: StateType): string {
  return STATE_TYPE_COLORS[t];
}

/** rank 0 = la prioridad más alta. */
export function priorityColor(rank: number): string {
  if (rank <= 0) return "#FF4D6D";
  if (rank === 1) return "#F5A623";
  if (rank === 2) return "#4C7FFF";
  return "#34D399";
}

export function siteSeverity(stat: { open: number; topPriorityOpen: number }): SiteSeverity {
  if (stat.topPriorityOpen > 0) return "urgente";
  if (stat.open > 0) return "warning";
  return "idle";
}
