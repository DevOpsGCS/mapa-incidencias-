import { describe, expect, it } from "vitest";
import { priorityColor } from "../src/lib/znunyColors";
import { priorityTextColor, priorityTint, SELECTION_STYLE } from "../src/lib/priorityTint";

describe("priorityTint", () => {
  it("card usa degradé vertical .14 -> .04 al 55%", () => {
    const t = priorityTint(0, "card");
    expect(t).toContain("rgba(255, 77, 109, 0.14)");
    expect(t).toContain("rgba(255, 77, 109, 0.04) 55%");
  });
  it("row usa degradé horizontal que llega a 0 en 34%", () => {
    const t = priorityTint(1, "row");
    expect(t).toContain("rgba(245, 166, 35, 0.1)");
    expect(t).toContain("0) 34%");
  });
  it("rank fuera de rango se acota a 0..3", () => {
    expect(priorityTint(7, "row")).toBe(priorityTint(3, "row"));
    expect(priorityTint(-1, "row")).toBe(priorityTint(0, "row"));
  });
  it("color de texto por rank", () => {
    expect(priorityTextColor(0)).toBe("#ff718a");
    expect(priorityTextColor(9)).toBe("#5ee0b0");
  });
  it("selección", () => {
    expect(SELECTION_STYLE).toEqual({ background: "var(--surface-3)", boxShadow: "0 0 0 1px rgba(0,122,252,.6)" });
  });
  it("rank NaN o infinito se trata como rank 3 (desconocido)", () => {
    expect(priorityTint(NaN, "row")).toBe(priorityTint(3, "row"));
    expect(priorityTint(Infinity, "card")).toBe(priorityTint(3, "card"));
    expect(priorityTextColor(NaN)).toBe("#5ee0b0");
    expect(priorityColor(NaN)).toBe("#34d399");
    expect(priorityColor(-1)).toBe("#ff4d6d");
  });
});
