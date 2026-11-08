import { describe, expect, it } from "vitest";
import { computeZnunyStats } from "../src/lib/znunyStats";
import { priorityColor, siteSeverity, stateTypeColor } from "../src/lib/znunyColors";
import { svDateKey } from "../src/lib/svTime";
import type { Site, StateType, Ticket } from "../src/types";

const NOW = new Date("2026-11-08T18:00:00Z");

function ticket(over: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    tn: "1",
    title: "t",
    queue: "Q",
    state: "open",
    stateType: "open" as StateType,
    priorityId: 3,
    priority: "normal",
    type: null,
    service: null,
    sla: null,
    owner: "o",
    responsible: null,
    customer: "c",
    siteId: "s1",
    siteKey: null,
    siteName: null,
    createdAt: "2026-11-08T12:00:00Z",
    changedAt: "2026-11-08T12:00:00Z",
    slaDueAt: null,
    znunyUrl: "",
    ...over,
  };
}

const sites: Site[] = [
  { id: "s1", name: "Sitio 1", type: "sede", lat: 0, lng: 0, znunyKey: "k1" },
  { id: "s2", name: "Sitio 2", type: "sede", lat: 0, lng: 0, znunyKey: "k2" },
];

describe("svDateKey", () => {
  it("usa el día calendario de El Salvador", () => {
    expect(svDateKey("2026-11-08T03:00:00Z")).toBe("2026-11-07");
    expect(svDateKey("2026-11-08T06:00:00Z")).toBe("2026-11-08");
  });
});

describe("computeZnunyStats", () => {
  it("closedToday respeta la medianoche de El Salvador", () => {
    const before = ticket({ stateType: "closed", changedAt: "2026-11-08T05:30:00Z" });
    const after = ticket({ id: 2, stateType: "closed", changedAt: "2026-11-08T06:30:00Z" });
    expect(computeZnunyStats([before], sites, 6, NOW).closedToday).toBe(0);
    expect(computeZnunyStats([after], sites, 6, NOW).closedToday).toBe(1);
  });

  it("la tendencia tiene 30 días en hora de El Salvador", () => {
    const stats = computeZnunyStats([ticket({ createdAt: "2026-11-08T03:00:00Z" })], sites, 6, NOW);
    expect(stats.trend).toHaveLength(30);
    expect(stats.trend[stats.trend.length - 1].date).toBe("2026-11-08");
    expect(stats.trend.find((p) => p.date === "2026-11-07")?.count).toBe(1);
    expect(stats.trend.find((p) => p.date === "2026-11-08")?.count).toBe(0);
  });

  it("topPriorityOpen cuenta solo abiertos con la prioridad máxima", () => {
    const tickets = [
      ticket({ id: 1, priorityId: 6 }),
      ticket({ id: 2, priorityId: 6, stateType: "closed" }),
      ticket({ id: 3, priorityId: 5 }),
      ticket({ id: 4, priorityId: 6, stateType: "pending" }),
    ];
    const stats = computeZnunyStats(tickets, sites, 6, NOW);
    expect(stats.topPriorityOpen).toBe(2);
    expect(stats.totalOpen).toBe(3);
    expect(stats.byStateType.closed).toBe(1);
  });

  it("bySite ignora siteId vacío pero total lo incluye", () => {
    const tickets = [ticket({ id: 1, siteId: "s1" }), ticket({ id: 2, siteId: "" })];
    const stats = computeZnunyStats(tickets, sites, 6, NOW);
    expect(stats.total).toBe(2);
    expect(stats.bySite.find((s) => s.siteId === "s1")?.total).toBe(1);
    expect(stats.bySite.some((s) => s.siteId === "")).toBe(false);
  });
});

describe("colores", () => {
  it("priorityColor por rank", () => {
    expect(priorityColor(0)).toBe("#FF4D6D");
    expect(priorityColor(3)).toBe("#34D399");
    expect(priorityColor(7)).toBe("#34D399");
  });
  it("stateTypeColor", () => {
    expect(stateTypeColor("pending")).toBe("#F5A623");
  });
  it("siteSeverity", () => {
    expect(siteSeverity({ open: 0, topPriorityOpen: 0 })).toBe("idle");
    expect(siteSeverity({ open: 2, topPriorityOpen: 0 })).toBe("warning");
    expect(siteSeverity({ open: 2, topPriorityOpen: 1 })).toBe("urgente");
  });
});
