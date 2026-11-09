import { beforeEach, describe, expect, it } from "vitest";
import {
  getPollerStatus,
  recordPollerError,
  recordPollerOk,
  resetPollerStatus,
  sanitizeError,
} from "../src/sockets/pollerStatus";

describe("pollerStatus", () => {
  beforeEach(() => resetPollerStatus());

  it("empieza vacío", () => {
    expect(getPollerStatus().tickets).toEqual({ lastOkAt: null, lastErrorAt: null, lastError: null });
  });

  it("guarda el último ok y el último error por poller", () => {
    recordPollerOk("tickets", new Date("2026-11-09T10:00:00Z"));
    recordPollerError("tickets", "boom", new Date("2026-11-09T10:00:20Z"));
    recordPollerOk("states", new Date("2026-11-09T10:00:05Z"));
    const s = getPollerStatus();
    expect(s.tickets).toEqual({
      lastOkAt: "2026-11-09T10:00:00.000Z",
      lastErrorAt: "2026-11-09T10:00:20.000Z",
      lastError: "boom",
    });
    expect(s.states.lastOkAt).toBe("2026-11-09T10:00:05.000Z");
    expect(s.states.lastError).toBeNull();
  });

  it("sanitizeError quita credenciales y trunca", () => {
    const out = sanitizeError("Access denied for user 'dashboard_ro' (using password: YES) password=abc user=bob");
    expect(out).not.toContain("abc");
    expect(out).not.toContain("bob");
    process.env.ZNUNY_DB_PASSWORD = "s3cretPass";
    expect(sanitizeError("fallo con s3cretPass dentro")).not.toContain("s3cretPass");
    delete process.env.ZNUNY_DB_PASSWORD;
    expect(sanitizeError("x".repeat(500)).length).toBeLessThanOrEqual(200);
  });

  it("recordPollerError sanea el mensaje", () => {
    recordPollerError("states", "bad password=zzz");
    expect(getPollerStatus().states.lastError).not.toContain("zzz");
  });
});
