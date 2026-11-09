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
