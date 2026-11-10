import { createPollLoop, PollLoop } from "./pollLoop";
import type { Server } from "socket.io";
import { znunyReadOnlyQuery } from "../znuny/db";
import { roomsForTicketQueue } from "../znuny/queueAccess";
import { findTicketsByIds } from "../znuny/ticketsRepository";
import { recordPollerError, recordPollerOk } from "./pollerStatus";
import { isNearCreation, parseMove, parseOwnerUpdate, parseStateUpdate } from "./pollerLogic";
import { znunyLocalToIso } from "../znuny/time";

const POLL_INTERVAL_MS = 20_000;

export interface StatePollerState {
  lastHistoryId: number;
}

export async function initStatePollerState(): Promise<StatePollerState> {
  const [row] = await znunyReadOnlyQuery<{ maxId: number | null }>(
    "SELECT MAX(id) AS maxId FROM ticket_history"
  );
  return { lastHistoryId: row?.maxId ?? 0 };
}

interface HistoryRow {
  id: number;
  ticket_id: number;
  type: string;
  name: string;
  create_time: string;
}

/** Nombre completo de los agentes (users de Znuny) por id. */
async function agentNames(ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await znunyReadOnlyQuery<{ id: number; name: string }>(
    "SELECT id, TRIM(CONCAT(first_name, ' ', last_name)) AS name FROM users WHERE id IN (?)",
    [ids]
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Propietario que tenía el ticket justo antes de la fila de historial dada. */
async function previousOwnerId(ticketId: number, historyId: number): Promise<number | null> {
  const [row] = await znunyReadOnlyQuery<{ owner_id: number }>(
    "SELECT owner_id FROM ticket_history WHERE ticket_id = ? AND id < ? ORDER BY id DESC LIMIT 1",
    [ticketId, historyId]
  );
  return row?.owner_id ?? null;
}

/**
 * Un ciclo: si lanza, lastHistoryId no avanza y el próximo ciclo reintenta.
 *
 * Lee del historial de Znuny los cambios de estado (StateUpdate → ticket:status_changed)
 * y los movimientos de cola y cambios de propietario (Move / OwnerUpdate →
 * ticket:changed). Todo se emite a las rooms de la cola ACTUAL del ticket: en
 * un movimiento de cola avisa solo a quienes ven la cola destino.
 */
export async function runStateCycle(io: Server, state: StatePollerState): Promise<void> {
  const rows = await znunyReadOnlyQuery<HistoryRow>(
    `SELECT h.id, h.ticket_id, ht.name AS type, h.name, h.create_time
       FROM ticket_history h
       JOIN ticket_history_type ht ON ht.id = h.history_type_id
      WHERE h.id > ? AND ht.name IN ('StateUpdate', 'Move', 'OwnerUpdate')
      ORDER BY h.id`,
    [state.lastHistoryId]
  );
  if (rows.length === 0) return;

  const tickets = await findTicketsByIds([...new Set(rows.map((r) => r.ticket_id))]);
  const byId = new Map(tickets.map((t) => [t.id, t]));

  // Propietarios: el nuevo viene en la fila; el anterior, de la fila previa del historial.
  const ownerChanges = new Map<number, { fromId: number | null; toId: number }>();
  for (const row of rows) {
    if (row.type !== "OwnerUpdate") continue;
    const parsed = parseOwnerUpdate(row.name);
    if (parsed) ownerChanges.set(row.id, { fromId: await previousOwnerId(row.ticket_id, row.id), toId: parsed.ownerId });
  }
  const names = await agentNames(
    [...new Set([...ownerChanges.values()].flatMap((c) => [c.toId, c.fromId ?? -1]).filter((id) => id > 0))]
  );

  for (const row of rows) {
    const ticket = byId.get(row.ticket_id);
    if (!ticket) continue; // merged/removed
    const rooms = roomsForTicketQueue(ticket.queue);

    if (row.type === "StateUpdate") {
      io.to(rooms).emit("ticket:status_changed", {
        id: ticket.id,
        // Id de la fila de ticket_history: el cliente lo usa para no avisar dos
        // veces del mismo cambio.
        historyId: row.id,
        from: parseStateUpdate(row.name)?.from ?? null,
        to: parseStateUpdate(row.name)?.to ?? ticket.state,
        ticket,
      });
      continue;
    }

    // Asignación/movimiento como parte de la creación: ya lo avisó "Ticket nuevo".
    if (isNearCreation(znunyLocalToIso(row.create_time), ticket.createdAt)) continue;

    if (row.type === "Move") {
      const move = parseMove(row.name);
      if (!move || move.from === move.to) continue;
      io.to(rooms).emit("ticket:changed", { id: ticket.id, historyId: row.id, kind: "queue", ...move, ticket });
    } else {
      const change = ownerChanges.get(row.id);
      if (!change || change.fromId === change.toId) continue;
      const to = names.get(change.toId) || parseOwnerUpdate(row.name)?.login || ticket.owner;
      const from = change.fromId ? names.get(change.fromId) ?? null : null;
      io.to(rooms).emit("ticket:changed", { id: ticket.id, historyId: row.id, kind: "owner", from, to, ticket });
    }
  }
  state.lastHistoryId = rows[rows.length - 1].id;
}

export function startZnunyStatePoller(io: Server): PollLoop {
  let state: StatePollerState | null = null;

  const tick = async () => {
    try {
      if (!state) {
        state = await initStatePollerState();
        console.log(`[znuny-poller] estados iniciado (lastHistoryId=${state.lastHistoryId})`);
      } else {
        await runStateCycle(io, state);
      }
      recordPollerOk("states");
    } catch (err) {
      console.error("[znuny-poller] error en el ciclo de estados:", err);
      recordPollerError("states", err instanceof Error ? err.message : String(err));
    }
  };
  const loop = createPollLoop(tick, POLL_INTERVAL_MS);
  loop.start();
  return loop;
}
