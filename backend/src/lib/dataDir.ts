import fs from "fs";
import path from "path";

/** Directorio junto al código donde viven los seeds (y, sin DATA_DIR, los datos reales). */
export const SEED_DIR = path.join(__dirname, "..", "data");

/** Archivos de datos reales que se migran a DATA_DIR. */
export const DATA_FILES = ["users.json", "site-metadata.json", "osticket-snapshot.json"];

interface ResolveOptions {
  envDataDir?: string;
  legacyDir: string;
  files: string[];
  log?: (m: string) => void;
}

/**
 * Resuelve el directorio de datos reales. Sin envDataDir devuelve legacyDir
 * sin tocar nada. Con envDataDir lo crea y copia (no mueve) desde legacyDir
 * los archivos que existan allí y falten en el destino; nunca pisa.
 */
export function resolveDataDir(opts: ResolveOptions): string {
  const { envDataDir, legacyDir, files, log } = opts;
  if (!envDataDir) return legacyDir;

  fs.mkdirSync(envDataDir, { recursive: true });
  for (const file of files) {
    const from = path.join(legacyDir, file);
    const to = path.join(envDataDir, file);
    if (fs.existsSync(to) || !fs.existsSync(from)) continue;
    fs.copyFileSync(from, to);
    log?.(`[dataDir] ${file} copiado de ${legacyDir} a ${envDataDir}`);
  }
  return envDataDir;
}

export const DATA_DIR = resolveDataDir({
  envDataDir: process.env.DATA_DIR,
  legacyDir: SEED_DIR,
  files: DATA_FILES,
  log: console.log,
});
