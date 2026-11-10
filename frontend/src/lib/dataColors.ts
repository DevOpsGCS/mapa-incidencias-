import { StateType } from "../types";

/** Única fuente de los colores de datos (prioridad y tipo de estado).
 *  Deben coincidir con --data-p* y --state-* de index.css (lo verifica test/tokens.test.ts). */

/** RGB por rank de prioridad (0 = la más alta; rank >= 3 o desconocido = 3). */
export const PRIORITY_RGB: [number, number, number][] = [
  [255, 77, 109],
  [245, 166, 35],
  [76, 127, 255],
  [52, 211, 153],
];

export const PRIORITY_HEX: string[] = ["#ff4d6d", "#f5a623", "#4c7fff", "#34d399"];

/** Color de texto legible sobre el tinte de cada prioridad. */
export const PRIORITY_TEXT_HEX: string[] = ["#ff718a", "#f7b84f", "#7099ff", "#5ee0b0"];

export const STATE_TYPE_HEX: Record<StateType, string> = {
  new: "#3ed6c4",
  open: "#4c7fff",
  pending: "#f5a623",
  closed: "#64748b",
};

/**
 * Tonos por estado dentro de cada tipo: Znuny puede tener varios estados del
 * mismo tipo (p. ej. "abierto", "En proceso de compra" y "Pendiente de
 * aprobación" son todos `open`) y con un solo color por tipo no se distinguen.
 * El primero de cada lista es el color del tipo (STATE_TYPE_HEX); los demás son
 * de la misma familia. Se asignan por id de estado (ver buildStateColorMap).
 */
export const STATE_SHADES_HEX: Record<StateType, string[]> = {
  new: ["#3ed6c4", "#67e8f9", "#5eead4"],
  open: ["#4c7fff", "#c084fc", "#38bdf8", "#818cf8", "#e879f9"],
  pending: ["#f5a623", "#fb923c", "#facc15", "#fda4af"],
  closed: ["#64748b", "#94a3b8", "#475569"],
};

/** Colores de la interfaz para atributos SVG (recharts), donde var(--x) puede no resolverse
 *  en navegadores de TV. Valores = tokens de index.css (--line, --text-label, --text-strong...). */
export const UI_HEX = {
  grid: "#1c1f24",
  axis: "#76829a",
  line: "#ffffff",
  tooltipBg: "#1c1f24",
  tooltipBorder: "#333943",
  tooltipText: "#ffffff",
  tooltipLabel: "#8b96aa",
};

/** Contorno del país en el mapa (atributo SVG de Leaflet; no es un token de la interfaz). */
export const MAP_BOUNDARY_HEX = "#3b82f6";
