import { SiteType } from "../types";
import { SiteSeverity } from "./znunyColors";

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  aduana_terrestre: "Terrestre",
  aduana_maritima: "Marítima",
  aduana_aerea: "Aérea",
  sede: "Sede administrativa",
};

// Tema oscuro navy (#0B1220): ver frontend/src/index.css para los tokens base.
export const SEVERITY_COLORS: Record<SiteSeverity, string> = {
  idle: "#64748B",
  warning: "#F5A623",
  urgente: "#FF4D6D",
};

export const ACCENT_CYAN = "#3ED6C4";

export const CHART_CHROME = {
  grid: "#1C2740",
  axis: "#1C2740",
  mutedText: "#8993AC",
  primaryText: "#E7ECF7",
  secondaryText: "#8993AC",
};
