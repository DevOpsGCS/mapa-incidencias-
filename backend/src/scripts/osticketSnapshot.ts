import "dotenv/config";
import path from "path";
import { DATA_DIR } from "../lib/dataDir";
import { writeSnapshot } from "../legacy/osticket/snapshot";
import { countExportableTickets, fetchAllTickets } from "../legacy/osticket/ticketsRepository";

/**
 * Congela el histórico de osTicket en DATA_DIR/osticket-snapshot.json.
 * Solo lee de osTicket. Falla (sin escribir) si el total exportado no
 * coincide con el conteo independiente de la base.
 */
async function main(): Promise<void> {
  const [tickets, expectedTotal] = await Promise.all([
    fetchAllTickets(null),
    countExportableTickets(),
  ]);
  const filePath = path.join(DATA_DIR, "osticket-snapshot.json");
  writeSnapshot({ tickets, expectedTotal, filePath });
  console.log(`Snapshot escrito: ${tickets.length} tickets en ${filePath}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Error generando el snapshot:", (error as Error).message);
  process.exit(1);
});
