import { SiteType } from "../types";
import { SiteSeverity } from "./znunyColors";
import { PRIORITY_HEX, STATE_TYPE_HEX } from "./dataColors";

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  aduana_terrestre: "Terrestre",
  aduana_maritima: "Marítima",
  aduana_aerea: "Aérea",
  sede: "Sede administrativa",
};

// Colores de datos: fuente única en dataColors.ts.
export const SEVERITY_COLORS: Record<SiteSeverity, string> = {
  idle: STATE_TYPE_HEX.closed,
  warning: PRIORITY_HEX[1],
  urgente: PRIORITY_HEX[0],
};

export const CHART_CHROME = {
  grid: "var(--line)",
  axis: "var(--line)",
  mutedText: "var(--text-label)",
  primaryText: "var(--text-strong)",
  secondaryText: "var(--text-muted)",
};
