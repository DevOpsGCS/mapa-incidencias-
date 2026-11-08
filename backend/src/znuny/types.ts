export type StateType = "new" | "open" | "pending" | "closed";

export interface Catalog {
  queues: { id: number; name: string; parent: string | null; valid: boolean }[];
  states: { id: number; name: string; type: StateType }[]; // solo válidos, sin merged/removed
  priorities: { id: number; name: string; rank: number }[]; // solo válidas; rank 0 = la más alta
  types: string[];
  services: string[];
  topPriorityId: number; // prioridad válida de mayor id (hoy "crítica")
}
