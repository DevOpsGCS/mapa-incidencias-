// Copia congelada del modelo osTicket (histórico). No importar nada del modelo Znuny.
export type LegacyTicketStatus = "open" | "resolved" | "closed";
export type LegacyTicketPriority = "low" | "normal" | "high" | "urgente";
export type LegacySiteType = "aduana_terrestre" | "aduana_maritima" | "aduana_aerea" | "sede";

export interface LegacyTicket {
  id: string;
  subject: string;
  status: LegacyTicketStatus;
  priority: LegacyTicketPriority;
  department: string;
  helpTopic: string;
  /** Equipo asignado (ost_team) — cruza departamentos, no es un hijo de department. "Sin equipo" si no tiene. */
  team: string;
  /** Agente asignado (ost_staff), nombre completo. "Sin asignar" si el ticket todavía no tiene uno (staff_id=0). */
  agent: string;
  siteId: string;
  createdAt: string;
  updatedAt: string;
  /** Vencimiento efectivo de SLA (duedate si está seteado a mano, si no est_duedate calculado por osTicket según el SLA asignado). null si el ticket no tiene ninguno de los dos. */
  slaDueAt: string | null;
  requester: string;
  /** Link al detalle del ticket en el panel real de osTicket. Ausente si OSTICKET_BASE_URL no está configurada. */
  osTicketUrl?: string;
}

export interface LegacySite {
  id: string;
  name: string;
  type: LegacySiteType;
  lat: number;
  lng: number;
}

export interface LegacySiteStat {
  siteId: string;
  siteName: string;
  total: number;
  open: number;
  urgenteOpen: number;
}

export interface LegacyTrendPoint {
  date: string;
  count: number;
}

export interface LegacyStats {
  total: number;
  byStatus: Record<LegacyTicketStatus, number>;
  byPriority: Record<LegacyTicketPriority, number>;
  bySite: LegacySiteStat[];
  totalOpen: number;
  totalUrgente: number;
  resolvedToday: number;
  trend: LegacyTrendPoint[];
}

export interface LegacyMeta {
  source: "live" | "snapshot";
  frozenAt: string | null;
  total: number;
}
