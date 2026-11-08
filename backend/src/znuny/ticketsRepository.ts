import { znunyReadOnlyQuery } from "./db";
import { znunyLocalToIso, epochToIsoOrNull } from "./time";
import { toSqlCondition, type QueueAccess } from "./queueAccess";
import { normalizeStateType, getSiteOptions } from "./catalogRepository";
import { sitesRepository } from "../repositories/sitesRepository";
import type { ZnunyTicket } from "./types";

/**
 * Lectura en vivo de tickets de Znuny. Termina en "WHERE 1=1" para que quien
 * lo use agregue "AND ...". El sitio es el campo dinámico "Ubicacion",
 * buscado siempre por nombre y nunca por id.
 */
export const ZNUNY_TICKETS_SELECT = `
SELECT
  t.id AS id,
  t.tn AS tn,
  t.title AS title,
  q.name AS queue,
  s.name AS state,
  st.name AS stateTypeName,
  p.id AS priorityId,
  p.name AS priority,
  tt.name AS type,
  sv.name AS service,
  sl.name AS sla,
  CONCAT(uo.first_name, ' ', uo.last_name) AS owner,
  CONCAT(ur.first_name, ' ', ur.last_name) AS responsible,
  COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), t.customer_user_id) AS customer,
  dfv.value_text AS siteKey,
  t.create_time AS createTimeRaw,
  t.change_time AS changeTimeRaw,
  t.escalation_solution_time AS escalationSolutionTime
FROM ticket t
JOIN queue q ON q.id = t.queue_id
JOIN ticket_state s ON s.id = t.ticket_state_id
JOIN ticket_state_type st ON st.id = s.type_id
JOIN ticket_priority p ON p.id = t.ticket_priority_id
LEFT JOIN ticket_type tt ON tt.id = t.type_id
LEFT JOIN service sv ON sv.id = t.service_id
LEFT JOIN sla sl ON sl.id = t.sla_id
LEFT JOIN users uo ON uo.id = t.user_id
LEFT JOIN users ur ON ur.id = t.responsible_user_id
LEFT JOIN customer_user cu ON cu.login = t.customer_user_id
LEFT JOIN dynamic_field_value dfv ON dfv.object_id = t.id
  AND dfv.field_id = (SELECT id FROM dynamic_field WHERE name = 'Ubicacion')
WHERE 1=1`;

export interface ZnunyTicketRow {
  id: number;
  tn: string;
  title: string;
  queue: string;
  state: string;
  stateTypeName: string;
  priorityId: number;
  priority: string;
  type: string | null;
  service: string | null;
  sla: string | null;
  owner: string | null;
  responsible: string | null;
  customer: string | null;
  siteKey: string | null;
  createTimeRaw: string;
  changeTimeRaw: string;
  escalationSolutionTime: number | null;
}

function znunyUrlFor(id: number): string {
  const base = (process.env.ZNUNY_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/index.pl?Action=AgentTicketZoom;TicketID=${id}`;
}

/** Traduce una fila al modelo del frontend; null = ticket excluido (merged/removed). */
export function mapZnunyRow(
  row: ZnunyTicketRow,
  siteLabels: Map<string, string>
): ZnunyTicket | null {
  const stateType = normalizeStateType(row.stateTypeName);
  if (stateType === null) return null;

  const siteKey = row.siteKey && row.siteKey !== "" ? row.siteKey : null;
  // Sin sitio mapeado, el ticket igual cuenta (siteId ""), mostrando la
  // etiqueta de Znuny o, si ya no está en PossibleValues, la clave cruda.
  const site = siteKey ? sitesRepository.findByZnunyKey(siteKey) : undefined;
  const siteName = siteKey ? (siteLabels.get(siteKey) ?? siteKey) : null;

  const owner = row.owner?.trim();
  const responsible = row.responsible?.trim();

  return {
    id: row.id,
    tn: row.tn,
    title: row.title,
    queue: row.queue,
    state: row.state,
    stateType,
    priorityId: row.priorityId,
    priority: row.priority,
    type: row.type ?? null,
    service: row.service ?? null,
    sla: row.sla ?? null,
    owner: owner ? owner : "Sin asignar",
    responsible: responsible ? responsible : null,
    customer: row.customer ?? "",
    siteId: site?.id ?? "",
    siteKey,
    siteName,
    createdAt: znunyLocalToIso(row.createTimeRaw),
    changedAt: znunyLocalToIso(row.changeTimeRaw),
    slaDueAt: epochToIsoOrNull(row.escalationSolutionTime),
    znunyUrl: znunyUrlFor(row.id),
  };
}

async function loadSiteLabels(): Promise<Map<string, string>> {
  const options = await getSiteOptions();
  return new Map(options.map((o) => [o.key, o.label]));
}

function mapAll(rows: ZnunyTicketRow[], labels: Map<string, string>): ZnunyTicket[] {
  return rows.flatMap((r) => {
    const t = mapZnunyRow(r, labels);
    return t ? [t] : [];
  });
}

/** Tickets visibles según el acceso por cola; el filtro va en el SQL (seguridad). */
export async function findAllTickets(access: QueueAccess): Promise<ZnunyTicket[]> {
  const cond = toSqlCondition(access, "q.name");
  if (access.kind === "none") return [];
  const [rows, labels] = await Promise.all([
    znunyReadOnlyQuery<ZnunyTicketRow>(
      `${ZNUNY_TICKETS_SELECT} AND ${cond.sql} ORDER BY t.create_time DESC`,
      cond.params
    ),
    loadSiteLabels(),
  ]);
  return mapAll(rows, labels);
}

/** Sin filtro de acceso: la usan los pollers, que reparten por room. */
export async function findTicketsByIds(ids: number[]): Promise<ZnunyTicket[]> {
  if (ids.length === 0) return [];
  const [rows, labels] = await Promise.all([
    znunyReadOnlyQuery<ZnunyTicketRow>(
      `${ZNUNY_TICKETS_SELECT} AND t.id IN (?) ORDER BY t.create_time DESC`,
      [ids]
    ),
    loadSiteLabels(),
  ]);
  return mapAll(rows, labels);
}
