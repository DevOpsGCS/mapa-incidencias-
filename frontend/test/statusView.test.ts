import { describe, expect, it } from "vitest";
import type { AdminStatus } from "../src/api/adminClient";
import { describeStatus } from "../src/lib/statusView";

const NOW = new Date("2026-11-09T18:00:00.000Z");
const iso = (secondsAgo: number) => new Date(NOW.getTime() - secondsAgo * 1000).toISOString();
const poller = (secondsAgo: number | null) => ({
  lastOkAt: secondsAgo === null ? null : iso(secondsAgo),
  lastErrorAt: null,
  lastError: null,
});

function status(over: Partial<AdminStatus["serviceDesk"]> = {}): AdminStatus {
  return {
    serviceDesk: {
      ok: true,
      latencyMs: 12,
      lastError: null,
      ticketPoller: poller(5),
      statePoller: poller(8),
      ...over,
    },
    legacy: { source: "live", frozenAt: null, total: null },
    server: { version: "1.0.0", startedAt: iso(1000) },
  };
}

describe("describeStatus", () => {
  it("ok cuando los pollers sincronizaron hace menos de 60 s", () => {
    const r = describeStatus(status(), NOW);
    expect(r.tone).toBe("ok");
    expect(r.headline).toBe("Conectado");
  });

  it("warn cuando algún poller lleva más de 60 s sin sincronizar", () => {
    const r = describeStatus(status({ statePoller: poller(95) }), NOW);
    expect(r.tone).toBe("warn");
    expect(r.headline).toBe("Conectado, sin sincronizar hace 95 s");
  });

  it("error cuando no hay conexión", () => {
    const r = describeStatus(status({ ok: false, latencyMs: null }), NOW);
    expect(r.tone).toBe("error");
    expect(r.headline).toBe("Sin conexión con la Mesa de Servicio");
  });

  it("incluye lastError en las líneas cuando está presente", () => {
    const r = describeStatus(status({ ok: false, lastError: "ECONNREFUSED" }), NOW);
    expect(r.lines.join("\n")).toContain("ECONNREFUSED");
    expect(describeStatus(status(), NOW).lines.join("\n")).not.toContain("ECONNREFUSED");
  });
});
