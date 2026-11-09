import { Ticket } from "../types";

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

/** Ticket mostrado en el detalle: el seleccionado si sigue visible; si no, el primero; vacío -> null. */
export function pickSelected(visible: Ticket[], selectedId: number | null): Ticket | null {
  if (visible.length === 0) return null;
  return visible.find((t) => t.id === selectedId) ?? visible[0];
}
