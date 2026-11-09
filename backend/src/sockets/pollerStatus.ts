// Registro en memoria del estado de los pollers de Znuny, para el panel
// admin "Estado de conexión". Se pierde al reiniciar (a propósito).

export type PollerName = "tickets" | "states";

export interface PollerStatus {
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

const empty = (): PollerStatus => ({ lastOkAt: null, lastErrorAt: null, lastError: null });
let status: Record<PollerName, PollerStatus> = { tickets: empty(), states: empty() };

/** Quita credenciales del mensaje y lo trunca a 200 caracteres. */
export function sanitizeError(message: string): string {
  let out = String(message ?? "");
  // Valores reales de la configuración (se omiten los vacíos).
  for (const secret of [
    process.env.ZNUNY_DB_PASSWORD,
    process.env.ZNUNY_DB_USER,
    process.env.ZNUNY_DB_HOST,
  ]) {
    if (secret) out = out.split(secret).join("***");
  }
  out = out
    .replace(/user\s+'[^']*'(@'[^']*')?/gi, "user '***'")
    .replace(/using password:\s*\w+/gi, "using password: ***")
    .replace(/(password|user)\s*=\s*\S+/gi, "$1=***");
  return out.slice(0, 200);
}

export function recordPollerOk(name: PollerName, at: Date = new Date()): void {
  status[name].lastOkAt = at.toISOString();
}

export function recordPollerError(name: PollerName, message: string, at: Date = new Date()): void {
  status[name].lastErrorAt = at.toISOString();
  status[name].lastError = sanitizeError(message);
}

export function getPollerStatus(): Record<PollerName, PollerStatus> {
  return { tickets: { ...status.tickets }, states: { ...status.states } };
}

/** Solo para pruebas. */
export function resetPollerStatus(): void {
  status = { tickets: empty(), states: empty() };
}
