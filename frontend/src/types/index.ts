export type Role = "admin" | "normal";

export interface CurrentUser {
  username: string;
  role: Role;
}

/** Fila de la tabla de usuarios del panel admin — a diferencia de CurrentUser (la sesión propia, sin email porque el JWT no lo lleva), esta sí incluye email. */
export interface AdminUserSummary {
  username: string;
  email: string;
  role: Role;
  /** Array vacío = sin restricción, ve todos los departamentos. */
  allowedDepartments: string[];
}

export type SiteType =
  | "aduana_terrestre"
  | "aduana_maritima"
  | "aduana_aerea"
  | "sede";

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  lat: number;
  lng: number;
  /** Clave de Ubicacion en Znuny; null si el sitio solo existe en el histórico osTicket. */
  znunyKey: string | null;
}

export type StateType = "new" | "open" | "pending" | "closed";

export interface Catalog {
  queues: { id: number; name: string; parent: string | null; valid: boolean }[];
  states: { id: number; name: string; type: StateType }[];
  priorities: { id: number; name: string; rank: number }[];
  types: string[];
  services: string[];
  topPriorityId: number;
}

/** Ticket de Znuny (espejo de ZnunyTicket del backend). */
export interface Ticket {
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
  /** "" si la clave de Ubicacion no tiene sitio mapeado. */
  siteId: string;
  siteKey: string | null;
  siteName: string | null;
  createdAt: string;
  changedAt: string;
  slaDueAt: string | null;
  znunyUrl: string;
}

export type QueueAccess = "all" | "some" | "none";
