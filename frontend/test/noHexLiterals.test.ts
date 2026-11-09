import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../src");
const ALLOWED = resolve(SRC, "lib/dataColors.ts");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe("sin hex literales", () => {
  it("ningún .ts/.tsx fuera de dataColors.ts contiene #rrggbb", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file === ALLOWED) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/#[0-9a-fA-F]{3,8}\b/.test(line)) offenders.push(`${file.replace(SRC + sep, "")}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
