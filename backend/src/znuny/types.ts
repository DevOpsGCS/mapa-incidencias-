export type StateType = "new" | "open" | "pending" | "closed";

export interface Catalog {
  queues: { id: number; name: string; parent: string | null; valid: boolean }[];
  states: { id: number; name: string; type: StateType }[]; // solo válidos, sin merged/removed
  priorities: { id: number; name: string; rank: number }[]; // solo válidas; rank 0 = la más alta
  types: string[];
  services: string[];
  topPriorityId: number; // prioridad válida de mayor id (hoy "crítica")
}

/** Ticket de Znuny (spec §5.1) más la etiqueta en vivo del sitio. */
export interface ZnunyTicket {
  id: number;
  tn: string;
  title: string;
  queue: string;
  state: string;
  stateType: StateType;
  priorityId: number;
  priority: string;
  type: string | null;
  service: string | null;
  sla: string | null;
  owner: string;
  responsible: string | null;
  customer: string;
  siteId: string;
  siteKey: string | null;
  siteName: string | null;
  createdAt: string;
  changedAt: string;
  slaDueAt: string | null;
  znunyUrl: string;
}
