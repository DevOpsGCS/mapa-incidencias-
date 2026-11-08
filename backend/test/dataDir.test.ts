import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { resolveDataDir } from "../src/lib/dataDir";

let legacyDir: string;
let base: string;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "datadir-"));
  legacyDir = path.join(base, "legacy");
  fs.mkdirSync(legacyDir);
});

describe("resolveDataDir", () => {
  it("sin envDataDir devuelve legacyDir y no copia nada", () => {
    fs.writeFileSync(path.join(legacyDir, "users.json"), "{}");
    const log = vi.fn();
    const result = resolveDataDir({ legacyDir, files: ["users.json"], log });
    expect(result).toBe(legacyDir);
    expect(log).not.toHaveBeenCalled();
    expect(fs.readdirSync(base)).toEqual(["legacy"]);
  });

  it("con envDataDir crea el directorio y copia los archivos faltantes", () => {
    fs.writeFileSync(path.join(legacyDir, "users.json"), '{"a":1}');
    fs.writeFileSync(path.join(legacyDir, "site-metadata.json"), '{"b":2}');
    const envDataDir = path.join(base, "nuevo", "datos");
    const log = vi.fn();
    const result = resolveDataDir({
      envDataDir,
      legacyDir,
      files: ["users.json", "site-metadata.json"],
      log,
    });
    expect(result).toBe(envDataDir);
    expect(fs.readFileSync(path.join(envDataDir, "users.json"), "utf-8")).toBe('{"a":1}');
    expect(fs.existsSync(path.join(legacyDir, "users.json"))).toBe(true);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("no pisa un archivo que ya existe en envDataDir", () => {
    fs.writeFileSync(path.join(legacyDir, "users.json"), "viejo");
    const envDataDir = path.join(base, "datos");
    fs.mkdirSync(envDataDir);
    fs.writeFileSync(path.join(envDataDir, "users.json"), "actual");
    resolveDataDir({ envDataDir, legacyDir, files: ["users.json"], log: vi.fn() });
    expect(fs.readFileSync(path.join(envDataDir, "users.json"), "utf-8")).toBe("actual");
  });

  it("ignora archivos que no existen en legacyDir", () => {
    const envDataDir = path.join(base, "datos");
    const log = vi.fn();
    resolveDataDir({ envDataDir, legacyDir, files: ["osticket-snapshot.json"], log });
    expect(fs.existsSync(path.join(envDataDir, "osticket-snapshot.json"))).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });
});
