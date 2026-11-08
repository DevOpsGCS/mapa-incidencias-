import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSnapshot, writeSnapshot } from "../src/legacy/osticket/snapshot";
import {
  fetchLegacyTickets,
  getLegacyMeta,
  getLegacySourceKind,
  getSnapshotDepartments,
} from "../src/legacy/osticket/source";
import type { LegacyTicket } from "../src/types";

function ticket(id: string, department: string): LegacyTicket {
  return {
    id,
    subject: `Ticket ${id}`,
    status: "open",
    priority: "normal",
    department,
    helpTopic: "Sin tema",
    team: "Sin equipo",
    agent: "Sin asignar",
    siteId: "s1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    slaDueAt: null,
    requester: "Alguien",
    osTicketUrl: `https://x/scp/tickets.php?id=${id}`,
  };
}

const THREE = [ticket("TCK-1", "CCTV"), ticket("TCK-2", "Redes"), ticket("TCK-3", "CCTV")];
const NOW = new Date("2026-11-09T15:30:00.000Z");

let dir: string;
let file: string;
const savedEnv = { ...process.env };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-test-"));
  file = path.join(dir, "osticket-snapshot.json");
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  process.env = { ...savedEnv };
});

describe("writeSnapshot", () => {
  it("escribe el archivo con total y frozenAt", () => {
    writeSnapshot({ tickets: THREE, expectedTotal: 3, filePath: file, now: NOW });
    const snap = readSnapshot(file);
    expect(snap.total).toBe(3);
    expect(snap.frozenAt).toBe(NOW.toISOString());
    expect(snap.tickets).toHaveLength(3);
  });

  it("lanza y no escribe nada si el total no coincide", () => {
    expect(() => writeSnapshot({ tickets: THREE, expectedTotal: 4, filePath: file })).toThrow(
      "El total exportado (3) no coincide con la base (4)"
    );
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("respalda el snapshot existente en .bak-YYYYMMDD", () => {
    writeSnapshot({ tickets: THREE, expectedTotal: 3, filePath: file, now: NOW });
    const before = fs.readFileSync(file, "utf8");
    writeSnapshot({ tickets: THREE.slice(0, 2), expectedTotal: 2, filePath: file, now: NOW });
    expect(fs.readFileSync(`${file}.bak-20261109`, "utf8")).toBe(before);
    expect(readSnapshot(file).total).toBe(2);
  });

  it("si la escritura falla deja el archivo anterior intacto", () => {
    writeSnapshot({ tickets: THREE, expectedTotal: 3, filePath: file, now: NOW });
    const before = fs.readFileSync(file, "utf8");
    const circular: any = { ...THREE[0] };
    circular.self = circular; // JSON.stringify lanza
    expect(() =>
      writeSnapshot({ tickets: [circular], expectedTotal: 1, filePath: file, now: NOW })
    ).toThrow();
    expect(fs.readFileSync(file, "utf8")).toBe(before);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
});

describe("fetchLegacyTickets (modo snapshot)", () => {
  beforeEach(() => {
    process.env.OSTICKET_SOURCE = "snapshot";
    writeSnapshot({ tickets: THREE, expectedTotal: 3, filePath: file, now: NOW });
  });

  it("filtra por departamento y omite osTicketUrl", async () => {
    const result = await fetchLegacyTickets(["CCTV"], file);
    expect(result.map((t) => t.id)).toEqual(["TCK-1", "TCK-3"]);
    expect(result.every((t) => t.department === "CCTV")).toBe(true);
    expect(result.every((t) => !("osTicketUrl" in t))).toBe(true);
  });

  it("null o [] devuelve todo", async () => {
    expect(await fetchLegacyTickets(null, file)).toHaveLength(3);
    expect(await fetchLegacyTickets([], file)).toHaveLength(3);
  });

  it("getSnapshotDepartments devuelve los departamentos distintos, ordenados", () => {
    expect(getSnapshotDepartments(file)).toEqual(["CCTV", "Redes"]);
  });

  it("getLegacyMeta informa el snapshot", async () => {
    expect(await getLegacyMeta(file)).toEqual({
      source: "snapshot",
      frozenAt: NOW.toISOString(),
      total: 3,
    });
  });
});

describe("getLegacySourceKind", () => {
  it("respeta OSTICKET_SOURCE", () => {
    process.env.OSTICKET_SOURCE = "live";
    expect(getLegacySourceKind()).toBe("live");
    process.env.OSTICKET_SOURCE = "snapshot";
    expect(getLegacySourceKind()).toBe("snapshot");
  });

  it("por defecto: live con DB_HOST, snapshot sin él", () => {
    delete process.env.OSTICKET_SOURCE;
    process.env.DB_HOST = "db";
    expect(getLegacySourceKind()).toBe("live");
    delete process.env.DB_HOST;
    expect(getLegacySourceKind()).toBe("snapshot");
  });
});
