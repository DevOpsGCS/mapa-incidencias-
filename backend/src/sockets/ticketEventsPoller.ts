import { Server } from "socket.io";
import { readOnlyQuery } from "../db";
import { STATUS_NAME_TO_APP, toDisplayTicketId } from "../repositories/ticketsRepository";
import { TicketStatus } from "../types";

const POLL_INTERVAL_MS = 20000; // misma cadencia que el poller de tickets (liveSimulator.ts)

interface ThreadEventRow {
  id: number;
  ticketId: number;
  number: string | null;
  data: string | null;
  departmentName: string | null;
}

export interface TicketStatusChangedPayload {
  ticketId: string;
  status: TicketStatus;
}

function extractStatusName(rawData: string | null): string | null {
  if (!rawData) return null;
  try {
    const parsed = JSON.parse(rawData) as { status?: [number, string] };
    return parsed.status?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Poller aparte, sobre ost_thread_event — el log de eventos REAL de
 * osTicket (quién hizo qué y cuándo), no el que ya usa liveSimulator.ts
 * sobre ost_ticket.lastupdate. Lo complementa, no lo reemplaza: emite un
 * evento dedicado cuando un ticket CAMBIA DE ESTADO. Con el volumen actual
 * de tickets, ticket:updated se pierde entre el ruido y nadie se entera de
 * un cierre/resolución — esto le da una señal propia.
 *
 * Cursor por `id` (no por timestamp): esta tabla es append-only, ninguna
 * fila ya insertada se vuelve a tocar, así que un entero incremental alcanza
 * y evita el lío de comparar datetimes contra el reloj del servidor de la
 * base (ver el comentario largo sobre timezones en liveSimulator.ts).
 */
export function startTicketEventsPoller(io: Server): void {
  let lastSeenId = 0;

  const tick = async () => {
    try {
      const rows = await readOnlyQuery<ThreadEventRow>(
        `SELECT te.id AS id, th.object_id AS ticketId, t.number AS number, te.data AS data, d.name AS departmentName
         FROM ost_thread_event te
         JOIN ost_thread th ON th.id = te.thread_id AND th.object_type = 'T'
         LEFT JOIN ost_ticket t ON t.ticket_id = th.object_id
         LEFT JOIN ost_department d ON d.id = t.dept_id
         WHERE te.id > ? AND JSON_EXTRACT(te.data, '$.status') IS NOT NULL
         ORDER BY te.id ASC`,
        [lastSeenId]
      );

      for (const row of rows) {
        lastSeenId = Math.max(lastSeenId, row.id);

        const statusName = extractStatusName(row.data);
        const status = statusName ? STATUS_NAME_TO_APP[statusName] : undefined;
        if (!status) continue; // palabra de estado no reconocida: no inventamos nada, se ignora

        const payload: TicketStatusChangedPayload = {
          // Mismo formato que mapRow: si no coincidiera, el frontend no
          // encontraría el ticket al aplicar el cambio de estado.
          ticketId: toDisplayTicketId(row.number, row.ticketId),
          status,
        };
        // El departamento solo decide la room de destino (mismo esquema que
        // liveSimulator.ts) — el payload que recibe el frontend no cambia.
        io.to(`department:${row.departmentName}`).to("all-departments").emit("ticket:status_changed", payload);
      }
    } catch (error) {
      console.error("[ticketEventsPoller] error consultando eventos:", (error as Error).message);
    } finally {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  // Arranca desde el mayor id ya existente — si arrancara desde 0 reemitiría
  // como "nuevo" todo el historial de cambios de estado la primera vez.
  readOnlyQuery<{ maxId: number | null }>("SELECT MAX(id) AS maxId FROM ost_thread_event")
    .then((rows) => {
      lastSeenId = rows[0]?.maxId ?? 0;
      setTimeout(tick, POLL_INTERVAL_MS);
    })
    .catch((error) => {
      console.error("[ticketEventsPoller] no se pudo obtener el watermark inicial:", error.message);
    });
}
