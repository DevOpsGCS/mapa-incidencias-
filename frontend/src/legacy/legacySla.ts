import { LegacyTicket } from "./types";

/**
 * % de SLA consumido (tiempo transcurrido / tiempo total hasta el
 * vencimiento), 0-100. Solo tiene sentido para tickets abiertos: uno
 * cerrado ya no está "por vencer" — devolver null ahí evita mostrar un
 * anillo que siga avanzando (y terminando siempre en rojo) mucho después
 * de resuelto. También null si el ticket no tiene fecha de vencimiento
 * (ni duedate ni est_duedate) o si esa fecha es anterior a la de creación
 * (dato inconsistente: no inventamos un porcentaje a partir de eso).
 */
export function computeSlaPercentage(ticket: Pick<LegacyTicket, "status" | "createdAt" | "slaDueAt">): number | null {
  if (ticket.status !== "open" || !ticket.slaDueAt) return null;

  const created = new Date(ticket.createdAt).getTime();
  const due = new Date(ticket.slaDueAt).getTime();
  if (due <= created) return null;

  const elapsed = ((Date.now() - created) / (due - created)) * 100;
  return Math.min(100, Math.max(0, elapsed));
}

/** 1-50% verde, 51-75% amarillo, 76-100% rojo (a punto de vencer) — mismos umbrales para el anillo (SlaRing) y la barra (SlaBar). */
export function colorForSlaPercentage(pct: number): string {
  if (pct <= 50) return "var(--green)";
  if (pct <= 75) return "var(--amber)";
  return "var(--red)";
}
