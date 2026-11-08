import path from "path";
import { DATA_DIR } from "../../lib/dataDir";
import { LegacyTicket } from "../../types";
import { readSnapshot } from "./snapshot";
import { fetchAllTickets } from "./ticketsRepository";

export type LegacySourceKind = "live" | "snapshot";

export function defaultSnapshotPath(): string {
  return path.join(DATA_DIR, "osticket-snapshot.json");
}

/**
 * Fuente del histórico de osTicket. OSTICKET_SOURCE manda; sin definir es
 * "live" si hay DB_HOST (osTicket todavía accesible) y "snapshot" si no.
 */
export function getLegacySourceKind(): LegacySourceKind {
  const explicit = process.env.OSTICKET_SOURCE;
  if (explicit === "live" || explicit === "snapshot") return explicit;
  return process.env.DB_HOST ? "live" : "snapshot";
}

/**
 * allowedDepartments null o [] = todos. snapshotPath existe para poder
 * apuntar a un archivo temporal en pruebas; por defecto es el de DATA_DIR.
 */
export async function fetchLegacyTickets(
  allowedDepartments: string[] | null,
  snapshotPath: string = defaultSnapshotPath()
): Promise<LegacyTicket[]> {
  if (getLegacySourceKind() === "live") {
    return fetchAllTickets(allowedDepartments);
  }
  const { tickets } = readSnapshot(snapshotPath);
  const scoped =
    allowedDepartments && allowedDepartments.length > 0
      ? tickets.filter((t) => allowedDepartments.includes(t.department))
      : tickets;
  // El snapshot no sabe de osTicket en vivo (se apaga): sin link al detalle.
  return scoped.map(({ osTicketUrl: _omit, ...rest }) => rest);
}

export async function getLegacyMeta(
  snapshotPath: string = defaultSnapshotPath()
): Promise<{ source: LegacySourceKind; frozenAt: string | null; total: number }> {
  if (getLegacySourceKind() === "live") {
    const tickets = await fetchAllTickets(null);
    return { source: "live", frozenAt: null, total: tickets.length };
  }
  const snap = readSnapshot(snapshotPath);
  return { source: "snapshot", frozenAt: snap.frozenAt, total: snap.total };
}
