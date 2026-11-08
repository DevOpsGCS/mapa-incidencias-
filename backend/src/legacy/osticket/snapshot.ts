import fs from "fs";
import { LegacyTicket } from "../../types";

export interface OsticketSnapshotFile {
  frozenAt: string;
  total: number;
  tickets: LegacyTicket[];
}

interface WriteSnapshotOptions {
  tickets: LegacyTicket[];
  /** Total que la base dice tener (countExportableTickets); si no coincide no se escribe nada. */
  expectedTotal: number;
  filePath: string;
  now?: Date;
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Escribe el snapshot congelado de osTicket de forma atómica: valida el
 * total, serializa, escribe a un temporal y recién entonces (tras respaldar
 * el snapshot anterior, si existe) lo renombra al destino. Cualquier falla
 * antes del rename deja el archivo anterior intacto.
 */
export function writeSnapshot(opts: WriteSnapshotOptions): void {
  const { tickets, expectedTotal, filePath } = opts;
  const now = opts.now ?? new Date();

  if (tickets.length !== expectedTotal) {
    throw new Error(
      `El total exportado (${tickets.length}) no coincide con la base (${expectedTotal})`
    );
  }

  const file: OsticketSnapshotFile = {
    frozenAt: now.toISOString(),
    total: tickets.length,
    tickets,
  };
  const json = JSON.stringify(file, null, 2);

  const tmpPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmpPath, json, "utf8");
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, `${filePath}.bak-${yyyymmdd(now)}`);
    }
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    fs.rmSync(tmpPath, { force: true });
    throw error;
  }
}

export function readSnapshot(filePath: string): OsticketSnapshotFile {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as OsticketSnapshotFile;
}
