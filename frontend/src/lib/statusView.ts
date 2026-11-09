import type { AdminStatus } from "../api/adminClient";

export type StatusTone = "ok" | "warn" | "error";

export interface StatusDescription {
  tone: StatusTone;
  headline: string;
  lines: string[];
}

/** Segundos transcurridos desde `iso`; `null` si no hay fecha válida. */
export function secondsSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const ms = now.getTime() - new Date(iso).getTime();
  return Number.isNaN(ms) ? null : Math.max(0, Math.round(ms / 1000));
}

const STALE_AFTER_SECONDS = 60;

/** Resume el estado de conexión con la Mesa de Servicio en un tono, un titular y líneas de detalle. */
export function describeStatus(s: AdminStatus, now: Date): StatusDescription {
  const sd = s.serviceDesk;
  const lines: string[] = [];
  if (sd.latencyMs !== null) lines.push(`Latencia ${sd.latencyMs} ms`);
  if (sd.lastError) lines.push(`Último error: ${sd.lastError}`);

  if (!sd.ok) {
    return { tone: "error", headline: "Sin conexión con la Mesa de Servicio", lines };
  }
  const ages = [sd.ticketPoller.lastOkAt, sd.statePoller.lastOkAt]
    .map((v) => secondsSince(v, now))
    .filter((v): v is number => v !== null);
  const oldest = ages.length ? Math.max(...ages) : 0;
  if (oldest > STALE_AFTER_SECONDS) {
    return { tone: "warn", headline: `Conectado, sin sincronizar hace ${oldest} s`, lines };
  }
  return { tone: "ok", headline: "Conectado", lines };
}
