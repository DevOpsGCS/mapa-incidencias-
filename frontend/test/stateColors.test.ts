import { describe, expect, it } from "vitest";
import { STATE_SHADES_HEX, STATE_TYPE_HEX } from "../src/lib/dataColors";
import { buildStateColorMap, stateColor } from "../src/lib/znunyColors";

const STATES = [
  { id: 12, name: "Pendiente de aprobación", type: "open" as const },
  { id: 4, name: "abierto", type: "open" as const },
  { id: 11, name: "En proceso de compra", type: "open" as const },
  { id: 2, name: "cerrado", type: "closed" as const },
  { id: 1, name: "nuevo", type: "new" as const },
];

describe("buildStateColorMap", () => {
  it("el estado de id más bajo de cada tipo conserva el color del tipo", () => {
    const map = buildStateColorMap(STATES);
    expect(map.get("abierto")).toBe(STATE_TYPE_HEX.open);
    expect(map.get("cerrado")).toBe(STATE_TYPE_HEX.closed);
    expect(map.get("nuevo")).toBe(STATE_TYPE_HEX.new);
  });

  it("estados del mismo tipo reciben tonos distintos, ordenados por id", () => {
    const map = buildStateColorMap(STATES);
    expect(map.get("En proceso de compra")).toBe(STATE_SHADES_HEX.open[1]);
    expect(map.get("Pendiente de aprobación")).toBe(STATE_SHADES_HEX.open[2]);
  });

  it("si hay más estados que tonos, se repiten", () => {
    const many = Array.from({ length: STATE_SHADES_HEX.closed.length + 1 }, (_, i) => ({
      id: i + 1,
      name: `c${i}`,
      type: "closed" as const,
    }));
    const map = buildStateColorMap(many);
    expect(map.get(`c${STATE_SHADES_HEX.closed.length}`)).toBe(STATE_SHADES_HEX.closed[0]);
  });

  it("un estado fuera del catálogo cae al color de su tipo", () => {
    expect(stateColor(buildStateColorMap(STATES), "desconocido", "pending")).toBe(STATE_TYPE_HEX.pending);
  });

  it("el primer tono de cada tipo es el color del tipo", () => {
    for (const type of ["new", "open", "pending", "closed"] as const) {
      expect(STATE_SHADES_HEX[type][0]).toBe(STATE_TYPE_HEX[type]);
    }
  });
});
