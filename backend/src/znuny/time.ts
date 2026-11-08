/**
 * Los DATETIME de Znuny están en hora de El Salvador (UTC-06:00 fijo, sin
 * horario de verano). Siempre se convierten con esta función.
 */
export function znunyLocalToIso(raw: string): string {
  return new Date(raw.replace(" ", "T") + "-06:00").toISOString();
}

/** Epoch Unix real (p. ej. escalation_solution_time). 0 / null equivalen a "sin valor". */
export function epochToIsoOrNull(epoch: number | string | null): string | null {
  if (epoch === null || epoch === undefined) return null;
  const n = Number(epoch);
  if (!Number.isFinite(n) || n === 0) return null;
  return new Date(n * 1000).toISOString();
}

const svFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/El_Salvador",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día calendario (YYYY-MM-DD) en hora de El Salvador para un instante ISO. */
export function svDateKey(iso: string): string {
  return svFormatter.format(new Date(iso));
}
