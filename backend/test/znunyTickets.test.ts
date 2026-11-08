import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/repositories/sitesRepository", () => ({
  sitesRepository: {
    findByZnunyKey: (key: string) =>
      key === "Santa Elena" ? { id: "santa-elena", name: "Santa Elena", znunyKey: key } : undefined,
  },
}));

import { mapZnunyRow, type ZnunyTicketRow } from "../src/znuny/ticketsRepository";

const baseRow: ZnunyTicketRow = {
  id: 149,
  tn: "202611056600015",
  title: "Falla de cámara",
  queue: "Tecnología::Servicios IT",
  state: "abierto",
  stateTypeName: "open",
  priorityId: 3,
  priority: "3 normal",
  type: "Incidente",
  service: "CCTV",
  sla: "SLA 12 días",
  owner: "Juan Pérez",
  responsible: "Ana López",
  customer: "Cliente Uno",
  siteKey: "Santa Elena",
  createTimeRaw: "2026-11-05 14:24:47",
  changeTimeRaw: "2026-11-05 15:00:00",
  escalationSolutionTime: 1794947087,
};

const labels = new Map([["Santa Elena", "Aduana Santa Elena"]]);

describe("mapZnunyRow", () => {
  beforeEach(() => {
    process.env.ZNUNY_BASE_URL = "https://mesadeservicio.gcslatam.com/znuny";
  });

  it("convierte fechas y arma el link", () => {
    const t = mapZnunyRow(baseRow, labels)!;
    expect(t.createdAt).toBe("2026-11-05T20:24:47.000Z");
    expect(t.slaDueAt).toBe("2026-11-17T20:24:47.000Z");
    expect(t.znunyUrl).toBe(
      "https://mesadeservicio.gcslatam.com/znuny/index.pl?Action=AgentTicketZoom;TicketID=149"
    );
    expect(t.stateType).toBe("open");
    expect(t.siteId).toBe("santa-elena");
    expect(t.siteName).toBe("Aduana Santa Elena");
  });

  it("una / final en ZNUNY_BASE_URL no produce //", () => {
    process.env.ZNUNY_BASE_URL = "https://mesadeservicio.gcslatam.com/znuny/";
    expect(mapZnunyRow(baseRow, labels)!.znunyUrl).toBe(
      "https://mesadeservicio.gcslatam.com/znuny/index.pl?Action=AgentTicketZoom;TicketID=149"
    );
  });

  it("merged se excluye", () => {
    expect(mapZnunyRow({ ...baseRow, stateTypeName: "merged" }, labels)).toBeNull();
  });

  it("valores nulos", () => {
    const t = mapZnunyRow(
      { ...baseRow, owner: null, responsible: null, service: null, sla: null, escalationSolutionTime: 0 },
      labels
    )!;
    expect(t.owner).toBe("Sin asignar");
    expect(t.responsible).toBeNull();
    expect(t.service).toBeNull();
    expect(t.sla).toBeNull();
    expect(t.slaDueAt).toBeNull();
  });

  it("siteKey sin sitio mapeado usa la etiqueta, o la clave cruda", () => {
    const withLabel = mapZnunyRow(
      { ...baseRow, siteKey: "Chinamas" },
      new Map([["Chinamas", "Aduana Chinamas"]])
    )!;
    expect(withLabel.siteId).toBe("");
    expect(withLabel.siteName).toBe("Aduana Chinamas");
    expect(withLabel.siteKey).toBe("Chinamas");
    const raw = mapZnunyRow({ ...baseRow, siteKey: "Chinamas" }, new Map())!;
    expect(raw.siteId).toBe("");
    expect(raw.siteName).toBe("Chinamas");
  });

  it("siteKey null", () => {
    const t = mapZnunyRow({ ...baseRow, siteKey: null }, labels)!;
    expect(t.siteId).toBe("");
    expect(t.siteName).toBeNull();
    expect(t.siteKey).toBeNull();
  });
});
