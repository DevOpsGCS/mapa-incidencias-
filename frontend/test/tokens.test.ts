import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIORITY_HEX, PRIORITY_RGB, PRIORITY_TEXT_HEX, STATE_TYPE_HEX, UI_HEX } from "../src/lib/dataColors";

const css = readFileSync(resolve(__dirname, "../src/index.css"), "utf8");
const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const vars: Record<string, string> = {};
for (const m of rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();

function lum(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("tokens de color", () => {
  const surface = vars["--surface-1"];
  it("define --surface-1", () => expect(surface).toBe("#15171b"));

  it.each(["--text-strong", "--text", "--text-muted", "--text-label", "--accent-text"])(
    "%s sobre --surface-1 >= 4.5",
    (name) => {
      expect(contrast(vars[name], surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("blanco sobre --accent-fill >= 4.5", () => {
    expect(contrast("#ffffff", vars["--accent-fill"])).toBeGreaterThanOrEqual(4.5);
  });

  it.each([0, 1, 2, 3])("--data-p%i-text sobre --surface-1 >= 4.5", (i) => {
    expect(contrast(vars[`--data-p${i}-text`], surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("variables de datos coinciden con dataColors.ts", () => {
    PRIORITY_HEX.forEach((hex, i) => {
      expect(vars[`--data-p${i}`].toLowerCase()).toBe(hex.toLowerCase());
      expect(vars[`--data-p${i}-text`].toLowerCase()).toBe(PRIORITY_TEXT_HEX[i].toLowerCase());
    });
    for (const [type, hex] of Object.entries(STATE_TYPE_HEX)) {
      expect(vars[`--state-${type}`].toLowerCase()).toBe(hex.toLowerCase());
    }
  });

  it("PRIORITY_RGB coincide con PRIORITY_HEX", () => {
    PRIORITY_RGB.forEach((rgb, i) => {
      const hex = "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
      expect(hex).toBe(PRIORITY_HEX[i].toLowerCase());
    });
  });

  it("UI_HEX coincide con las variables de index.css", () => {
    const map: Record<keyof typeof UI_HEX, string> = {
      grid: "--line",
      axis: "--text-label",
      line: "--text-strong",
      tooltipBg: "--surface-2",
      tooltipBorder: "--line-strong",
      tooltipText: "--text-strong",
      tooltipLabel: "--text-muted",
    };
    for (const [key, name] of Object.entries(map)) {
      expect(UI_HEX[key as keyof typeof UI_HEX].toLowerCase()).toBe(vars[name].toLowerCase());
    }
    expect(Object.keys(UI_HEX).sort()).toEqual(Object.keys(map).sort());
  });
});

describe("tokens de vidrio y glow", () => {
  it.each(["--glass-bg", "--glass-blur", "--glass-edge", "--glass-shadow", "--glow-select", "--glow-critical"])("define %s", (n) => {
    expect(vars[n]).toBeTruthy();
  });
  it("define .glass, .app-backdrop y el fallback sólido", () => {
    expect(css).toMatch(/\.glass\s*\{/);
    expect(css).toMatch(/\.app-backdrop\s*\{/);
    expect(css).toMatch(/@supports not/);
  });
});
