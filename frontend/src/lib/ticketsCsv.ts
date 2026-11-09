import { ColumnId, COLUMN_LABELS } from "./tableColumns";
import { Ticket } from "../types";

const SV_TZ = "America/El_Salvador";

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SV_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function svParts(date: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** dd/mm/aaaa HH:mm en hora de El Salvador. */
function formatCsvDate(iso: string): string {
  const p = svParts(new Date(iso));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Escape RFC 4180: comillas si hay coma, comilla o salto de línea. */
function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export interface CsvContext {
  siteName(t: Ticket): string;
  priorityName(t: Ticket): string;
}

function cellValue(t: Ticket, col: ColumnId, ctx: CsvContext): string {
  switch (col) {
    case "tn":
      return t.tn;
    case "title":
      return t.title;
    case "queue":
      return t.queue;
    case "priority":
      return ctx.priorityName(t);
    case "state":
      return t.state;
    case "owner":
      return t.owner;
    case "site":
      return ctx.siteName(t);
    case "sla":
      return t.sla ?? "";
    case "created":
      return formatCsvDate(t.createdAt);
    case "type":
      return t.type ?? "";
    case "service":
      return t.service ?? "";
    case "responsible":
      return t.responsible ?? "";
    case "customer":
      return t.customer;
  }
}

/** CSV con BOM (Excel) y CRLF; solo las columnas pedidas, en ese orden. */
export function ticketsToCsv(tickets: Ticket[], columns: ColumnId[], ctx: CsvContext): string {
  const header = columns.map((c) => escapeCell(COLUMN_LABELS[c])).join(",");
  const rows = tickets.map((t) => columns.map((c) => escapeCell(cellValue(t, c, ctx))).join(","));
  return "\uFEFF" + [header, ...rows].join("\r\n");
}

export function csvFileName(now: Date): string {
  const p = svParts(now);
  return `tickets-${p.year}${p.month}${p.day}-${p.hour}${p.minute}.csv`;
}
