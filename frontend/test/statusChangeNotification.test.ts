import { describe, expect, it } from "vitest";
import { applyDashboardEvent } from "../src/hooks/dashboardReducer";
import { decideStatusChangeNotification } from "../src/hooks/statusChangeNotification";
import type { StatusChangedPayload } from "../src/hooks/useSocket";
import type { Ticket } from "../src/types";

function ticket(id: number, state = "open"): Ticket {
  return {
    id, tn: String(id), title: "t", queue: "Q", state, stateType: "open", priorityId: 1, priority: "p",
    type: null, service: null, sla: null, owner: "o", responsible: null, customer: "c", siteId: "",
    siteKey: null, siteName: null, createdAt: "2026-11-08T00:00:00Z", changedAt: "2026-11-08T00:00:00Z",
    slaDueAt: null, znunyUrl: "",
  };
}

function payload(over: Partial<StatusChangedPayload> = {}): StatusChangedPayload {
  return { id: 1, historyId: 100, from: "new", to: "open", ticket: ticket(1, "open"), ...over };
}

describe("decideStatusChangeNotification", () => {
  it("ticket no cargado (id desconocido) -> no avisa", () => {
    expect(decideStatusChangeNotification(payload(), undefined, new Set()).notify).toBe(false);
  });

  it("from !== to -> avisa con el estado anterior del evento", () => {
    const d = decideStatusChangeNotification(payload(), ticket(1, "new"), new Set());
    expect(d).toEqual({ notify: true, previousState: "new", key: "h:100" });
  });

  it("avisa aunque un ticket:updated del mismo ciclo ya haya traído el estado nuevo", () => {
    const d = decideStatusChangeNotification(payload(), ticket(1, "open"), new Set());
    expect(d.notify).toBe(true);
    expect(d.previousState).toBe("new");
  });

  it("from === to -> no avisa", () => {
    expect(decideStatusChangeNotification(payload({ from: "open" }), ticket(1, "new"), new Set()).notify).toBe(false);
  });

  it("from null -> compara contra el estado que tenía el cliente", () => {
    const p = payload({ from: null });
    expect(decideStatusChangeNotification(p, ticket(1, "new"), new Set())).toEqual({
      notify: true,
      previousState: "new",
      key: "h:100",
    });
    expect(decideStatusChangeNotification(p, ticket(1, "open"), new Set()).notify).toBe(false);
  });

  it("el mismo evento de historial no se avisa dos veces", () => {
    expect(decideStatusChangeNotification(payload(), ticket(1, "new"), new Set(["h:100"])).notify).toBe(false);
    // Otro evento (otra fila de historial) del mismo ticket sí.
    expect(decideStatusChangeNotification(payload({ historyId: 101 }), ticket(1, "new"), new Set(["h:100"])).notify).toBe(true);
  });

  it("sin historyId usa ticket+from+to como clave", () => {
    const p = payload({ historyId: undefined });
    const d = decideStatusChangeNotification(p, ticket(1, "new"), new Set());
    expect(d.key).toBe("t:1|new|open");
    expect(decideStatusChangeNotification(p, ticket(1, "new"), new Set([d.key!])).notify).toBe(false);
  });
});

describe("cambio de cola visto por un socket en la room vieja y en la nueva", () => {
  it("removed y luego updated (orden del poller) -> el ticket queda presente", () => {
    const moved = { ...ticket(5), queue: "Tecnología" };
    let tickets = [{ ...ticket(5), queue: "CCTV" }, ticket(6)];
    tickets = applyDashboardEvent(tickets, { type: "removed", id: 5 });
    tickets = applyDashboardEvent(tickets, { type: "updated", ticket: moved });
    expect(tickets.find((t) => t.id === 5)).toEqual(moved);
    expect(tickets).toHaveLength(2);
  });
});
