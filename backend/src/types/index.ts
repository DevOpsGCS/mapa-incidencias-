export type LegacyTicketStatus = "open" | "resolved" | "closed";

export type Role = "admin" | "normal";

export interface PublicUser {
  username: string;
  email: string;
  role: Role;
  /** Array vacío = sin restricción, ve todos los departamentos. Array con nombres = solo ve esos (deben coincidir en vivo con ost_department). */
  allowedDepartments: string[];
  /** null = campo ausente (sin acceso a Znuny); [] = todas las colas; lista = esas colas y subcolas. */
  allowedQueues: string[] | null;
}

export type LegacyTicketPriority = "low" | "normal" | "high" | "urgente";

export type SiteType =
  | "aduana_terrestre"
  | "aduana_maritima"
  | "aduana_aerea"
  | "sede";

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

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  lat: number;
  lng: number;
  /** Clave de Ubicacion en Znuny; null si el sitio solo existe en el histórico osTicket. */
  znunyKey: string | null;
}

export interface SiteStat {
  siteId: string;
  siteName: string;
  total: number;
  open: number;
  urgenteOpen: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface TicketStats {
  total: number;
  byStatus: Record<LegacyTicketStatus, number>;
  byPriority: Record<LegacyTicketPriority, number>;
  bySite: SiteStat[];
  totalOpen: number;
  totalUrgente: number;
  resolvedToday: number;
  trend: TrendPoint[];
}

export interface TicketFilters {
  siteId?: string;
  status?: LegacyTicketStatus;
  priority?: LegacyTicketPriority;
}
