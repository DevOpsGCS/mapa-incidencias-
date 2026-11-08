import { describe, expect, it } from "vitest";
import { applyDashboardEvent } from "../src/hooks/dashboardReducer";
import type { Ticket } from "../src/types";

function ticket(id: number, state = "open"): Ticket {
  return {
    id, tn: String(id), title: "t", queue: "Q", state, stateType: "open", priorityId: 1, priority: "p",
    type: null, service: null, sla: null, owner: "o", responsible: null, customer: "c", siteId: "",
    siteKey: null, siteName: null, createdAt: "2026-11-08T00:00:00Z", changedAt: "2026-11-08T00:00:00Z",
    slaDueAt: null, znunyUrl: "",
  };
}

describe("applyDashboardEvent", () => {
  const base = [ticket(1), ticket(2)];

  it("removed con id desconocido devuelve el mismo array", () => {
    expect(applyDashboardEvent(base, { type: "removed", id: 99 })).toBe(base);
  });
  it("removed de un id existente lo quita", () => {
    expect(applyDashboardEvent(base, { type: "removed", id: 1 }).map((t) => t.id)).toEqual([2]);
  });
  it("status_changed de un id ausente devuelve el mismo array", () => {
    const event = { type: "status_changed" as const, id: 99, from: "a", to: "b", ticket: ticket(99) };
    expect(applyDashboardEvent(base, event)).toBe(base);
  });
  it("status_changed de un id existente reemplaza el ticket", () => {
    const next = ticket(1, "closed");
    const result = applyDashboardEvent(base, { type: "status_changed", id: 1, from: "open", to: "closed", ticket: next });
    expect(result[0]).toBe(next);
  });
  it("updated de un id existente lo reemplaza", () => {
    const next = ticket(2, "pending");
    const result = applyDashboardEvent(base, { type: "updated", ticket: next });
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(next);
  });
  it("updated de un id ausente lo agrega", () => {
    expect(applyDashboardEvent(base, { type: "updated", ticket: ticket(3) })).toHaveLength(3);
  });
  it("new de un id existente no lo duplica", () => {
    const result = applyDashboardEvent(base, { type: "new", ticket: ticket(1, "x") });
    expect(result).toHaveLength(2);
    expect(result[0].state).toBe("x");
  });
  it("new de un id nuevo lo agrega al frente", () => {
    expect(applyDashboardEvent(base, { type: "new", ticket: ticket(5) })[0].id).toBe(5);
  });
});
