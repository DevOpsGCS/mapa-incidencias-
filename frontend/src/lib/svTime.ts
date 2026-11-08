const SV_TZ = "America/El_Salvador";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SV_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-SV", {
  timeZone: SV_TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Día calendario (aaaa-mm-dd) en hora de El Salvador, independiente de la zona del navegador. */
export function svDateKey(iso: string): string {
  return dateKeyFormatter.format(new Date(iso));
}

export function formatSvDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
