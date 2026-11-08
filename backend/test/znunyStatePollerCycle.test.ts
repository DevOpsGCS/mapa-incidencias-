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
      { id: 101, ticket_id: 5, name: "%%nuevo%%abierto%%" },
      { id: 102, ticket_id: 5, name: "%%abierto%%cerrado%%" },
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
});
