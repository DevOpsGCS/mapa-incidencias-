import "dotenv/config";
import { describe, it, expect } from "vitest";
import { znunyReadOnlyQuery } from "../../src/znuny/db";
import { findAllTickets, findTicketsByIds } from "../../src/znuny/ticketsRepository";

const VISIBLE = `st.name NOT IN ('merged','removed')`;
const FROM = `FROM ticket t JOIN queue q ON q.id = t.queue_id
  JOIN ticket_state s ON s.id = t.ticket_state_id
  JOIN ticket_state_type st ON st.id = s.type_id`;

describe("repositorio de tickets de Znuny (BD real, solo lectura)", () => {
  it("all: mismo largo que COUNT(*) y mismos conteos por cola", async () => {
    const all = await findAllTickets({ kind: "all" });
    const [{ n }] = await znunyReadOnlyQuery<{ n: number }>(
      `SELECT COUNT(*) AS n ${FROM} WHERE ${VISIBLE}`
    );
    expect(all.length).toBe(Number(n));
    const byQueue = await znunyReadOnlyQuery<{ name: string; n: number }>(
      `SELECT q.name AS name, COUNT(*) AS n ${FROM} WHERE ${VISIBLE} GROUP BY q.name`
    );
    const mine = new Map<string, number>();
    for (const t of all) mine.set(t.queue, (mine.get(t.queue) ?? 0) + 1);
    expect(mine.size).toBe(byQueue.length);
    for (const r of byQueue) expect(mine.get(r.name)).toBe(Number(r.n));
  });

  it("some Tecnología: solo esa cola y subcolas", async () => {
    const some = await findAllTickets({ kind: "some", queues: ["Tecnología"] });
    expect(some.length).toBeGreaterThan(0);
    for (const t of some) {
      expect(t.queue === "Tecnología" || t.queue.startsWith("Tecnología::")).toBe(true);
    }
  });

  it("none devuelve []", async () => {
    expect(await findAllTickets({ kind: "none" })).toEqual([]);
  });

  it("findTicketsByIds trae el ticket 149", async () => {
    const r = await findTicketsByIds([149]);
    expect(r.map((t) => t.id)).toEqual([149]);
    expect(await findTicketsByIds([])).toEqual([]);
  });
});
