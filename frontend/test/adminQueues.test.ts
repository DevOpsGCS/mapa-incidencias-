import { describe, expect, it } from "vitest";
import {
  buildQueuesPayload,
  modeFromAllowedQueues,
  NO_SPECIFIC_QUEUES_ERROR,
  queueCellFor,
  unknownQueuesNotices,
} from "../src/lib/adminQueues";

describe("modeFromAllowedQueues", () => {
  it("null = sin acceso, [] = todas, lista = específicas", () => {
    expect(modeFromAllowedQueues(null)).toBe("none");
    expect(modeFromAllowedQueues([])).toBe("all");
    expect(modeFromAllowedQueues(["CCTV"])).toBe("specific");
  });
});

describe("buildQueuesPayload", () => {
  it("todas envía []", () => {
    expect(buildQueuesPayload("all", ["CCTV"])).toEqual({ ok: true, value: [] });
  });
  it("sin acceso envía null", () => {
    expect(buildQueuesPayload("none", ["CCTV"])).toEqual({ ok: true, value: null });
  });
  it("específicas envía la selección", () => {
    expect(buildQueuesPayload("specific", ["CCTV", "Redes"])).toEqual({ ok: true, value: ["CCTV", "Redes"] });
  });
  it("específicas sin colas se bloquea, nunca envía []", () => {
    expect(buildQueuesPayload("specific", [])).toEqual({ ok: false, error: NO_SPECIFIC_QUEUES_ERROR });
  });
});

describe("queueCellFor", () => {
  it("elige la etiqueta según allowedQueues", () => {
    expect(queueCellFor(null)).toEqual({ kind: "pending" });
    expect(queueCellFor([])).toEqual({ kind: "all" });
    expect(queueCellFor(["A"])).toEqual({ kind: "list", queues: ["A"] });
  });
});

describe("unknownQueuesNotices", () => {
  it("null = no verificado, sin error rojo", () => {
    expect(unknownQueuesNotices(null)).toEqual({
      kind: "unverified",
      text: "No se pudo verificar (Znuny no disponible)",
    });
  });
  it("lista vacía = sin avisos", () => {
    expect(unknownQueuesNotices([])).toEqual([]);
  });
  it("una por cola desconocida", () => {
    expect(unknownQueuesNotices(["Vieja"])).toEqual([
      { kind: "error", text: "Cola inexistente en Znuny: Vieja" },
    ]);
  });
});
