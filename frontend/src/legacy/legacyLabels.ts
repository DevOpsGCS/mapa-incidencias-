import { LegacyTicketPriority, LegacyTicketStatus } from "./types";

export const STATUS_LABELS: Record<LegacyTicketStatus, string> = {
  open: "Abierto",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export const PRIORITY_LABELS: Record<LegacyTicketPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgente: "Urgente",
};

/** Rank de prioridad (0 = la más alta) para el tinte de fila: urgente/alta/normal/baja = 0/1/2/3. */
export const LEGACY_PRIORITY_RANK: Record<LegacyTicketPriority, number> = {
  urgente: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// Colores de punto de las columnas Estado/Prioridad: tokens de index.css, sin hex.
export const STATUS_DOT_COLORS: Record<LegacyTicketStatus, string> = {
  open: "var(--state-open)",
  resolved: "var(--data-p3)",
  closed: "var(--state-closed)",
};

export const PRIORITY_DOT_COLORS: Record<LegacyTicketPriority, string> = {
  urgente: "var(--data-p0)",
  high: "var(--data-p1)",
  normal: "var(--data-p2)",
  low: "var(--data-p3)",
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-SV", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/El_Salvador",
  });
}
