import { describe, expect, it } from "vitest";
import {
  buildQueuesPayload,
  modeFromAllowedQueues,
  NO_SPECIFIC_QUEUES_ERROR,
  mergeKnownSelection,
  queueCellFor,
  queuesChanged,
  splitSelectedQueues,
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
      text: "No se pudo verificar (Mesa de Servicio no disponible)",
    });
  });
  it("lista vacía = sin avisos", () => {
    expect(unknownQueuesNotices([])).toEqual([]);
  });
  it("una por cola desconocida", () => {
    expect(unknownQueuesNotices(["Vieja"])).toEqual([
      { kind: "error", text: "Cola inexistente en la Mesa de Servicio: Vieja" },
    ]);
  });
});

describe("splitSelectedQueues", () => {
  const catalog = [
    { name: "CCTV", valid: true },
    { name: "Vieja", valid: false },
  ];
  it("separa colas válidas de inexistentes o inválidas", () => {
    expect(splitSelectedQueues(["CCTV", "Renombrada", "Vieja"], catalog)).toEqual({
      known: ["CCTV"],
      unknown: ["Renombrada", "Vieja"],
    });
  });
  it("sin catálogo (Znuny caído) todo cuenta como existente", () => {
    expect(splitSelectedQueues(["X"], null)).toEqual({ known: ["X"], unknown: [] });
  });
  it("quitar la inexistente deja un payload válido", () => {
    const { unknown } = splitSelectedQueues(["CCTV", "Renombrada"], catalog);
    const afterRemoval = mergeKnownSelection(unknown.filter((q) => q !== "Renombrada"), ["CCTV"]);
    expect(buildQueuesPayload("specific", afterRemoval)).toEqual({ ok: true, value: ["CCTV"] });
  });
  it("mergeKnownSelection conserva las inexistentes no quitadas", () => {
    expect(mergeKnownSelection(["Renombrada"], ["CCTV"])).toEqual(["Renombrada", "CCTV"]);
  });
});

describe("queuesChanged", () => {
  it("misma selección (en otro orden) no cuenta como cambio", () => {
    expect(queuesChanged(["CCTV", "Redes"], ["Redes", "CCTV"])).toBe(false);
    expect(queuesChanged([], [])).toBe(false);
    expect(queuesChanged(null, null)).toBe(false);
  });
  it("cambio de modo o de colas sí", () => {
    expect(queuesChanged(null, [])).toBe(true);
    expect(queuesChanged([], null)).toBe(true);
    expect(queuesChanged(["CCTV"], [])).toBe(true);
    expect(queuesChanged(["CCTV"], ["Redes"])).toBe(true);
    expect(queuesChanged(["CCTV"], ["CCTV", "Redes"])).toBe(true);
  });
});
