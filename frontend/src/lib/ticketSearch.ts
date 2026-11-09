import { Ticket } from "../types";

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Busca por Nº (parcial) o título, sin distinguir mayúsculas ni tildes. Vacío = todo. */
export function matchesSearch(ticket: Ticket, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return normalize(ticket.tn).includes(q) || normalize(ticket.title).includes(q);
}
