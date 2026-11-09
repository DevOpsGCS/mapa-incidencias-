import { describe, expect, it } from "vitest";
import { queueAccessCounts } from "../src/lib/queueAccessCounts";
import { AdminUserSummary, Catalog, Ticket } from "../src/types";

const queues: Catalog["queues"] = [
  { id: 1, name: "Tecnología", parent: null, valid: true },
  { id: 2, name: "Tecnología::Servicios IT", parent: "Tecnología", valid: true },
  { id: 3, name: "Vieja", parent: null, valid: false },
];

function user(username: string, allowedQueues: string[] | null): AdminUserSummary {
  return { username, email: `${username}@x.com`, role: "normal", allowedDepartments: [], allowedQueues, unknownQueues: [] };
}

function ticket(queue: string, stateType: Ticket["stateType"]): Ticket {
  return { queue, stateType } as Ticket;
}

const find = (rows: ReturnType<typeof queueAccessCounts>, name: string) => rows.find((r) => r.name === name)!;

describe("queueAccessCounts", () => {
  it("un usuario con la cola padre cuenta en la subcola y uno con [] cuenta en todas", () => {
    const rows = queueAccessCounts(queues, [user("a", ["Tecnología"]), user("b", [])], []);
    expect(find(rows, "Tecnología::Servicios IT").usersWithAccess).toBe(2);
    expect(find(rows, "Tecnología").usersWithAccess).toBe(2);
  });

  it("un usuario con una subcola no cuenta en la cola padre", () => {
    const rows = queueAccessCounts(queues, [user("a", ["Tecnología::Servicios IT"])], []);
    expect(find(rows, "Tecnología").usersWithAccess).toBe(0);
    expect(find(rows, "Tecnología::Servicios IT").usersWithAccess).toBe(1);
  });

  it("un usuario con null no cuenta", () => {
    const rows = queueAccessCounts(queues, [user("a", null)], []);
    expect(rows.every((r) => r.usersWithAccess === 0)).toBe(true);
  });

  it("un ticket cerrado no suma a openTickets", () => {
    const rows = queueAccessCounts(queues, [], [ticket("Tecnología", "closed"), ticket("Tecnología", "open")]);
    expect(find(rows, "Tecnología").openTickets).toBe(1);
  });

  it("un ticket en A::B suma a A y a A::B", () => {
    const rows = queueAccessCounts(queues, [], [ticket("Tecnología::Servicios IT", "new")]);
    expect(find(rows, "Tecnología").openTickets).toBe(1);
    expect(find(rows, "Tecnología::Servicios IT").openTickets).toBe(1);
  });

  it("solo incluye colas válidas, ordenadas por nombre, con depth", () => {
    const rows = queueAccessCounts([...queues].reverse(), [], []);
    expect(rows.map((r) => r.name)).toEqual(["Tecnología", "Tecnología::Servicios IT"]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1]);
  });
});

describe("orden por segmentos", () => {
  it("A, A::C y luego A B", () => {
    const qs: Catalog["queues"] = ["A B", "A::C", "A"].map((name, i) => ({ id: i, name, parent: null, valid: true }));
    expect(queueAccessCounts(qs, [], []).map((r) => r.name)).toEqual(["A", "A::C", "A B"]);
  });
  it("Tecnología no cuenta tickets de TecnologíaX (frontera)", () => {
    const rows = queueAccessCounts(queues, [user("a", ["TecnologíaX"])], [ticket("TecnologíaX", "open")]);
    expect(find(rows, "Tecnología").openTickets).toBe(0);
    expect(find(rows, "Tecnología").usersWithAccess).toBe(0);
  });
});
