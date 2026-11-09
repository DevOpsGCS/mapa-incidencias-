import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Ningún texto visible puede decir "Znuny": para el usuario es la "Mesa de Servicio".
// Los identificadores (znunyUrl, computeZnunyStats, ZnunyStats) no cuentan.
const SRC = join(__dirname, "..", "src");
const DIRS = ["components", "admin", "auth", "lib"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "legacy" ? [] : walk(full);
    return /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
  });
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const PATTERNS: Array<[string, RegExp]> = [
  ["texto JSX", /(?<![=-])>[^<>{}]*\bZnuny\b/],
  ["atributo title/aria-label/placeholder", /(title|aria-label|placeholder)=\s*(\{\s*)?[^>]*\bZnuny\b/],
  ["literal string", /(["'`])[^"'`\n]*(\sZnuny|Znuny\s)[^"'`\n]*\1/],
];

describe("textos de la interfaz", () => {
  it("no muestra la palabra Znuny al usuario", () => {
    const hits: string[] = [];
    for (const d of DIRS) {
      for (const file of walk(join(SRC, d))) {
        const code = stripComments(readFileSync(file, "utf8"));
        for (const [label, re] of PATTERNS) {
          if (re.test(code)) hits.push(`${relative(SRC, file)} (${label})`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
