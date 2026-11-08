import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const findMock = vi.fn();
vi.mock("../src/znuny/db", () => ({ znunyReadOnlyQuery: (...a: unknown[]) => queryMock(...a) }));
vi.mock("../src/znuny/ticketsRepository", () => ({
  findTicketsByIds: (...a: unknown[]) => findMock(...a),
}));

import { runTicketCycle, type TicketPollerState } from "../src/sockets/znunyTicketPoller";

function fakeIo() {
  const events: { rooms: string[]; event: string; payload: unknown }[] = [];
  return {
    events,
    to: (rooms: string[]) => ({
      emit: (event: string, payload: unknown) => events.push({ rooms, event, payload }),
    }),
    emit: vi.fn(),
  };
}
const t = (id: number, queue: string) => ({ id, queue });
const newState = (): TicketPollerState => ({
  lastId: 10,
  watermark: "2026-11-08 10:00:00",
  seen: new Set(),
  queues: new Map(),
});

beforeEach(() => {
  queryMock.mockReset();
  findMock.mockReset();
});

describe("runTicketCycle", () => {
  it("id nuevo -> ticket:new a las rooms de su cola", async () => {
    const io = fakeIo();
    const state = newState();
    queryMock.mockResolvedValue([{ id: 11, change_time: "2026-11-08 10:00:03" }]);
    findMock.mockResolvedValue([t(11, "CCTV")]);
    await runTicketCycle(io as never, state);
    expect(io.events).toEqual([
      { rooms: ["all-queues", "queue:CCTV"], event: "ticket:new", payload: t(11, "CCTV") },
    ]);
    expect(state.lastId).toBe(11);
    expect(state.queues.get(11)).toBe("CCTV");
  });

  it("cambio de cola -> updated a las rooms nuevas y removed a las viejas", async () => {
    const io = fakeIo();
    const state = newState();
    state.queues.set(5, "CCTV");
    queryMock.mockResolvedValue([{ id: 5, change_time: "2026-11-08 10:00:04" }]);
    findMock.mockResolvedValue([t(5, "Tecnología")]);
    await runTicketCycle(io as never, state);
    expect(io.events.map((e) => e.event)).toEqual(["ticket:updated", "ticket:removed"]);
    expect(io.events[1]).toMatchObject({ rooms: ["queue:CCTV"], payload: { id: 5 } });
  });

  it("ticket que pasa a merged/removed -> removed a su última cola", async () => {
    const io = fakeIo();
    const state = newState();
    state.queues.set(5, "CCTV");
    queryMock.mockResolvedValue([{ id: 5, change_time: "2026-11-08 10:00:04" }]);
    findMock.mockResolvedValue([]);
    await runTicketCycle(io as never, state);
    expect(io.events).toEqual([
      { rooms: ["all-queues", "queue:CCTV"], event: "ticket:removed", payload: { id: 5 } },
    ]);
    expect(state.queues.has(5)).toBe(false);
  });

  it("si una consulta falla no avanza el estado y el siguiente ciclo re-emite", async () => {
    const io = fakeIo();
    const state = newState();
    queryMock.mockResolvedValue([{ id: 11, change_time: "2026-11-08 10:00:03" }]);
    findMock.mockRejectedValueOnce(new Error("tunel caído"));
    await expect(runTicketCycle(io as never, state)).rejects.toThrow();
    expect(state.lastId).toBe(10);
    expect(state.watermark).toBe("2026-11-08 10:00:00");
    expect(io.events).toEqual([]);

    findMock.mockResolvedValue([t(11, "CCTV")]);
    await runTicketCycle(io as never, state);
    expect(io.events.map((e) => e.event)).toEqual(["ticket:new"]);
  });
});
