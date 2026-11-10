import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const findMock = vi.fn();
vi.mock("../src/znuny/db", () => ({ znunyReadOnlyQuery: (...a: unknown[]) => queryMock(...a) }));
vi.mock("../src/znuny/ticketsRepository", () => ({
  findTicketsByIds: (...a: unknown[]) => findMock(...a),
}));

import { runStateCycle } from "../src/sockets/znunyStatePoller";

beforeEach(() => {
  queryMock.mockReset();
  findMock.mockReset();
});

describe("runStateCycle", () => {
  it("varios StateUpdate del mismo ticket reportan cada estado intermedio", async () => {
    const events: { event: string; payload: any }[] = [];
    const io = { to: () => ({ emit: (event: string, payload: unknown) => events.push({ event, payload: payload as any }) }) };
    queryMock.mockResolvedValue([
      { id: 101, ticket_id: 5, type: "StateUpdate", name: "%%nuevo%%abierto%%", create_time: "2026-11-10 09:00:00" },
      { id: 102, ticket_id: 5, type: "StateUpdate", name: "%%abierto%%cerrado%%", create_time: "2026-11-10 09:01:00" },
    ]);
    findMock.mockResolvedValue([{ id: 5, queue: "CCTV", state: "cerrado" }]);
    const state = { lastHistoryId: 100 };
    await runStateCycle(io as never, state);
    expect(events.map((e) => [e.payload.from, e.payload.to])).toEqual([
      ["nuevo", "abierto"],
      ["abierto", "cerrado"],
    ]);
    // historyId = fila de ticket_history: el frontend deduplica avisos con él.
    expect(events.map((e) => e.payload.historyId)).toEqual([101, 102]);
    expect(state.lastHistoryId).toBe(102);
  });

  it("Move y OwnerUpdate emiten ticket:changed a las rooms de la cola destino", async () => {
    const emits: { rooms: unknown; event: string; payload: any }[] = [];
    const io = {
      to: (rooms: unknown) => ({ emit: (event: string, payload: unknown) => emits.push({ rooms, event, payload: payload as any }) }),
    };
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes("FROM ticket_history h")) {
        return Promise.resolve([
          { id: 201, ticket_id: 7, type: "Move", name: "%%TI::Back Office%%17%%TI::Servicios IT%%6", create_time: "2026-11-10 10:00:00" },
          { id: 202, ticket_id: 7, type: "OwnerUpdate", name: "%%mariana.ayala%%15", create_time: "2026-11-10 10:00:30" },
        ]);
      }
      if (sql.includes("SELECT owner_id FROM ticket_history")) return Promise.resolve([{ owner_id: 8 }]);
      if (sql.includes("FROM users")) return Promise.resolve([{ id: 8, name: "Cristian Castro" }, { id: 15, name: "Mariana Ayala" }]);
      return Promise.resolve([]);
    });
    // Creado el día anterior: no es parte de la creación.
    findMock.mockResolvedValue([{ id: 7, queue: "TI::Back Office", state: "abierto", owner: "Mariana Ayala", createdAt: "2026-11-09T16:00:00.000Z" }]);
    const state = { lastHistoryId: 200 };
    await runStateCycle(io as never, state);
    expect(emits.map((e) => [e.event, e.payload.kind, e.payload.from, e.payload.to])).toEqual([
      ["ticket:changed", "queue", "TI::Servicios IT", "TI::Back Office"],
      ["ticket:changed", "owner", "Cristian Castro", "Mariana Ayala"],
    ]);
    // Solo la cola destino (y sus padres) + all-queues; nunca la cola de origen.
    expect(emits[0].rooms).toContain("queue:TI::Back Office");
    expect(emits[0].rooms).not.toContain("queue:TI::Servicios IT");
    expect(state.lastHistoryId).toBe(202);
  });

  it("no avisa asignaciones hechas al crear el ticket (ya avisó 'Ticket nuevo')", async () => {
    const emits: unknown[] = [];
    const io = { to: () => ({ emit: (...a: unknown[]) => emits.push(a) }) };
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes("FROM ticket_history h")) {
        return Promise.resolve([{ id: 301, ticket_id: 9, type: "OwnerUpdate", name: "%%x%%15", create_time: "2026-11-10 10:00:30" }]);
      }
      if (sql.includes("SELECT owner_id FROM ticket_history")) return Promise.resolve([{ owner_id: 1 }]);
      if (sql.includes("FROM users")) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    // 10:00 hora de El Salvador = 16:00 UTC; el cambio fue 30 s después de crearse.
    findMock.mockResolvedValue([{ id: 9, queue: "TI", state: "nuevo", owner: "X", createdAt: "2026-11-10T16:00:00.000Z" }]);
    const state = { lastHistoryId: 300 };
    await runStateCycle(io as never, state);
    expect(emits).toEqual([]);
    expect(state.lastHistoryId).toBe(301);
  });
});
