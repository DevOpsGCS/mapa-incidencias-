import { describe, it, expect, vi } from "vitest";
import {
  normalizeStateType,
  rankPriorities,
  parseDropdownOptions,
} from "../src/znuny/catalogRepository";

describe("normalizeStateType", () => {
  it("normaliza los pending a pending", () => {
    expect(normalizeStateType("pending reminder")).toBe("pending");
    expect(normalizeStateType("pending auto")).toBe("pending");
  });
  it("excluye merged y removed", () => {
    expect(normalizeStateType("merged")).toBeNull();
    expect(normalizeStateType("removed")).toBeNull();
  });
  it("respeta los tipos conocidos", () => {
    expect(normalizeStateType("new")).toBe("new");
    expect(normalizeStateType("open")).toBe("open");
    expect(normalizeStateType("closed")).toBe("closed");
  });
  it("trata un tipo desconocido como open y avisa", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeStateType("raro")).toBe("open");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("rankPriorities", () => {
  it("rank 0 = id más alto", () => {
    const r = rankPriorities([
      { id: 2, name: "baja" },
      { id: 6, name: "crítica" },
      { id: 4, name: "alta" },
      { id: 3, name: "normal" },
    ]);
    const byName = Object.fromEntries(r.map((p) => [p.name, p.rank]));
    expect(byName).toEqual({ crítica: 0, alta: 1, normal: 2, baja: 3 });
  });
});

describe("parseDropdownOptions", () => {
  it("lee PossibleValues del YAML de Znuny", () => {
    const yaml = "DefaultValue: ''\nPossibleNone: '1'\nPossibleValues:\n  Anguiatu: Anguiatú\n  Poy: Poy\n";
    expect(parseDropdownOptions(yaml)).toEqual([
      { key: "Anguiatu", label: "Anguiatú" },
      { key: "Poy", label: "Poy" },
    ]);
  });
  it("devuelve [] si no hay PossibleValues", () => {
    expect(parseDropdownOptions("DefaultValue: ''\n")).toEqual([]);
  });
});

import { normalizeStateColor } from "../src/znuny/catalogRepository";

describe("normalizeStateColor", () => {
  it("convierte #RRGGBBAA de Znuny a #rrggbb", () => {
    expect(normalizeStateColor("#50B5FFFF")).toBe("#50b5ff");
    expect(normalizeStateColor("#1B841B")).toBe("#1b841b");
  });
  it("vacío o con formato raro → null", () => {
    expect(normalizeStateColor(null)).toBeNull();
    expect(normalizeStateColor("")).toBeNull();
    expect(normalizeStateColor("red")).toBeNull();
    expect(normalizeStateColor("#12345")).toBeNull();
  });
});
