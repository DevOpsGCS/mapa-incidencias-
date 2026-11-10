import { roomsForTicketQueue } from "../znuny/queueAccess";

/**
 * Lógica pura de los pollers de Znuny (sin base ni sockets).
 * Las marcas de agua son strings crudos "YYYY-MM-DD HH:MM:SS": se comparan
 * como string, nunca se convierten a Date.
 */

export interface ChangedRow {
  id: number;
  changeTimeRaw: string;
}

/**
 * Dado lo leído con `change_time >= watermark`, devuelve los ids aún no
 * emitidos, la nueva marca de agua y las claves "id|change_time" ya vistas
 * en esa marca (para no repetir tickets del mismo segundo).
 */
export function selectChanged(
  rows: ChangedRow[],
  watermark: string,
  seen: Set<string>
): { ids: number[]; watermark: string; seen: Set<string> } {
  let newWatermark = watermark;
  for (const row of rows) {
    if (row.changeTimeRaw > newWatermark) newWatermark = row.changeTimeRaw;
  }

  const ids: number[] = [];
  const nextSeen = new Set<string>();
  // Si la marca no avanzó, se conservan las claves ya vistas en ella.
  if (newWatermark === watermark) {
    for (const key of seen) nextSeen.add(key);
  }
  for (const row of rows) {
    if (row.changeTimeRaw < watermark) continue;
    const key = `${row.id}|${row.changeTimeRaw}`;
    if (!seen.has(key)) ids.push(row.id);
    if (row.changeTimeRaw === newWatermark) nextSeen.add(key);
  }
  return { ids, watermark: newWatermark, seen: nextSeen };
}

/** "%%nuevo%%abierto%%" -> { from: "nuevo", to: "abierto" } */
export function parseStateUpdate(historyName: string): { from: string; to: string } | null {
  const match = /^%%(.*?)%%(.*?)%%/.exec(historyName);
  if (!match) return null;
  return { from: match[1], to: match[2] };
}

/**
 * Rooms de la cola vieja que la nueva no cubre: los clientes de esas rooms
 * deben quitar el ticket. Nunca incluye "all-queues".
 */
export function removalRooms(oldQueue: string, newQueue: string): string[] {
  const kept = new Set(roomsForTicketQueue(newQueue));
  return roomsForTicketQueue(oldQueue).filter((r) => r !== "all-queues" && !kept.has(r));
}

/** Fila "Move" de ticket_history: "%%ColaNueva%%idNueva%%ColaAnterior%%idAnterior". */
export function parseMove(historyName: string): { from: string; to: string } | null {
  const match = /^%%(.*?)%%\d*%%(.*?)%%\d*$/.exec(historyName);
  if (!match) return null;
  return { to: match[1], from: match[2] };
}

/** Fila "OwnerUpdate" de ticket_history: "%%login_nuevo%%idNuevo" (no trae el anterior). */
export function parseOwnerUpdate(historyName: string): { login: string; ownerId: number } | null {
  const match = /^%%(.*?)%%(\d+)$/.exec(historyName);
  if (!match) return null;
  return { login: match[1], ownerId: Number(match[2]) };
}

/**
 * Al crear un ticket, Znuny suele registrar también una asignación de
 * propietario o un movimiento de cola en el mismo minuto: eso ya lo avisa
 * "Ticket nuevo", así que esos cambios no se notifican aparte.
 */
export const NEAR_CREATION_MS = 90_000;
export function isNearCreation(changeIso: string, createdIso: string, windowMs = NEAR_CREATION_MS): boolean {
  const diff = Date.parse(changeIso) - Date.parse(createdIso);
  return Number.isFinite(diff) && diff >= 0 && diff < windowMs;
}
