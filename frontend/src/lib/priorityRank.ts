import { Catalog } from "../types";

/** id de prioridad → rank (0 = la más alta), a partir del catálogo en vivo. */
export function buildPriorityRankMap(catalog: Catalog | null): Map<number, number> {
  const map = new Map<number, number>();
  catalog?.priorities.forEach((p) => map.set(p.id, p.rank));
  return map;
}

/** Prioridad desconocida (no está en el catálogo): se trata como la más baja. */
export const UNKNOWN_PRIORITY_RANK = 3;
