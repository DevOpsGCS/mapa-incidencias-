import { LegacySiteStat, LegacySiteType, LegacyTicketPriority, LegacyTicketStatus } from "./types";

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

export const SITE_TYPE_LABELS: Record<LegacySiteType, string> = {
  aduana_terrestre: "Terrestre",
  aduana_maritima: "Marítima",
  aduana_aerea: "Aérea",
  sede: "Sede administrativa",
};

// Paleta "Propuesta A — Mapa como lienzo": tema oscuro navy (#0B1220) con
// acentos azul/ámbar/verde/rojo/cian. Ver frontend/src/index.css para los
// tokens base (--blue, --amber, --green, --red, --slate, --cyan).
//
// Los pares bg/texto de las badges de abajo NO son "color al 15% de opacidad
// + texto saturado" (ese esquema medía tan solo 3.3–4.1:1 en algunos casos,
// por debajo del mínimo WCAG AA). Son colores sólidos precalculados
// (bg = acento mezclado 18% sobre la superficie "glass"; texto = acento
// aclarado 20% hacia blanco) y verificados con la fórmula de contraste real
// — el peor caso (slate) da 4.62:1, con margen sobre el mínimo de 4.5:1.
export const PRIORITY_BADGE_CLASSES: Record<LegacyTicketPriority, string> = {
  low: "bg-[#1E2737] text-[#8390A2] ring-1 ring-inset ring-[#64748B]/30",
  normal: "bg-[#1A294C] text-[#7099FF] ring-1 ring-inset ring-[#4C7FFF]/30",
  high: "bg-[#383025] text-[#F7B84F] ring-1 ring-inset ring-[#F5A623]/30",
  urgente: "bg-[#3A2032] text-[#FF718A] ring-1 ring-inset ring-[#FF4D6D]/30",
};

export type LegacySiteSeverity = "idle" | "warning" | "urgente";

export function getLegacySiteSeverity(stat: Pick<LegacySiteStat, "open" | "urgenteOpen">): LegacySiteSeverity {
  if (stat.urgenteOpen > 0) return "urgente";
  if (stat.open > 0) return "warning";
  return "idle";
}

export const LEGACY_SEVERITY_COLORS: Record<LegacySiteSeverity, string> = {
  idle: "#64748B",
  warning: "#F5A623",
  urgente: "#FF4D6D",
};

export const STATUS_CHART_COLORS: Record<LegacyTicketStatus, string> = {
  open: "#4C7FFF",
  resolved: "#34D399",
  closed: "#64748B",
};

// Colores de punto para la variante "dot + texto" (sin caja/borde) de las
// columnas Estado/Prioridad en la tabla de tickets.
export const STATUS_DOT_COLORS = STATUS_CHART_COLORS;

export const PRIORITY_DOT_COLORS: Record<LegacyTicketPriority, string> = {
  urgente: "#FF4D6D",
  high: "#F5A623",
  normal: "#4C7FFF",
  low: "#34D399",
};

export const ACCENT_CYAN = "#3ED6C4";

export const CHART_CHROME = {
  grid: "#1C2740",
  axis: "#1C2740",
  mutedText: "#8993AC",
  primaryText: "#E7ECF7",
  secondaryText: "#8993AC",
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-SV", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
