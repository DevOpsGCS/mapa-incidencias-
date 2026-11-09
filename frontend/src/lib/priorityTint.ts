import { PRIORITY_RGB, PRIORITY_TEXT_HEX } from "./dataColors";

/** Alfa inicial del tinte horizontal de las filas, por rank de prioridad. */
const ROW_ALPHA = [0.12, 0.1, 0.09, 0.08];

function clampRank(rank: number): number {
  if (Number.isNaN(rank)) return 3;
  if (rank < 0) return 0;
  return Math.min(Math.floor(rank), 3); // Infinity => 3
}

/** `background-image` CSS del tinte de prioridad (nunca una barra lateral). */
export function priorityTint(rank: number, variant: "card" | "row"): string {
  const r = clampRank(rank);
  const [R, G, B] = PRIORITY_RGB[r];
  const c = (a: number) => `rgba(${R}, ${G}, ${B}, ${a})`;
  if (variant === "card") {
    return `linear-gradient(180deg, ${c(0.14)}, ${c(0.04)} 55%)`;
  }
  return `linear-gradient(90deg, ${c(ROW_ALPHA[r])}, ${c(0)} 34%)`;
}

/** Color de texto legible sobre el tinte de la prioridad. */
export function priorityTextColor(rank: number): string {
  return PRIORITY_TEXT_HEX[clampRank(rank)];
}

/** Selección: fondo --surface-3 + contorno azul de 1 px. */
export const SELECTION_STYLE = {
  background: "var(--surface-3)",
  boxShadow: "0 0 0 1px rgba(0,122,252,.6)",
};

/** Selección para filas a ancho completo en listas con scroll: el aro va por dentro para no recortarse. */
export const SELECTION_STYLE_INSET = {
  background: "var(--surface-3)",
  boxShadow: "inset 0 0 0 1px rgba(0,122,252,.6)",
};
