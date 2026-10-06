import { readOnlyQuery } from "../db";
import {
  Ticket,
  TicketFilters,
  TicketPriority,
  TicketStats,
  TicketStatus,
} from "../types";
import { sitesRepository } from "./sitesRepository";

const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgente"];
const STATUSES: TicketStatus[] = ["open", "resolved", "closed"];
const TREND_DAYS = 30;

// Sin barra final, para no terminar con "//scp" al armar la URL. Si no está
// configurada, los tickets simplemente no llevan link a osTicket (ver mapRow).
const OSTICKET_BASE_URL = process.env.OSTICKET_BASE_URL?.replace(/\/+$/, "");

// Único lugar que sabe cuál es, dentro de nuestro vocabulario ya traducido
// (TicketPriority), el valor que cuenta como "urgente" para totalUrgente y
// urgenteOpen — así ambos cálculos quedan atados a la misma fuente en vez
// de repetir el literal "urgente" en cada comparación.
const URGENTE_PRIORITY: TicketPriority = "urgente";

// osTicket guarda la PALABRA de cada prioridad/estado en ost_ticket_priority
// / ost_ticket_status — nunca asumimos qué ID corresponde a cuál (eso fue
// justo el origen de un bug: si alguien reordena esas tablas en osTicket,
// un mapeo por ID fijo queda mal sin que nadie lo note). Lo único fijo acá
// es la traducción de la palabra real de osTicket a nuestro propio
// vocabulario de UI — una decisión de nombres nuestra, no un dato que
// osTicket "posea".
const PRIORITY_WORD_TO_APP: Record<string, TicketPriority> = {
  low: "low",
  normal: "normal",
  high: "high",
  emergency: "urgente", // osTicket guarda esta prioridad como "emergency", pero en la base real se muestra como "Urgente" — usamos esa misma palabra tal cual, sin reinterpretarla.
};

const STATUS_NAME_TO_APP: Record<string, TicketStatus> = {
  Abierto: "open",
  Resuelto: "resolved",
  Cerrado: "closed",
};

async function loadPriorityAppById(): Promise<Map<number, TicketPriority>> {
  const rows = await readOnlyQuery<{ priority_id: number; priority: string }>(
    "SELECT priority_id, priority FROM ost_ticket_priority"
  );
  const map = new Map<number, TicketPriority>();
  for (const row of rows) {
    map.set(row.priority_id, PRIORITY_WORD_TO_APP[row.priority] ?? "normal");
  }
  return map;
}

/**
 * null = fuera del dashboard (Archivado/Borrado, o un estado nuevo que no
 * reconocemos por nombre): esos tickets ni cuentan en stats ni aparecen en
 * listados, igual que antes, pero ahora la exclusión sale del campo `state`
 * real de ost_ticket_status en vez de una lista de IDs fija.
 */
async function loadStatusAppById(): Promise<Map<number, TicketStatus | null>> {
  const rows = await readOnlyQuery<{ id: number; name: string; state: string }>(
    "SELECT id, name, state FROM ost_ticket_status"
  );
  const map = new Map<number, TicketStatus | null>();
  for (const row of rows) {
    if (row.state === "archived" || row.state === "deleted") {
      map.set(row.id, null);
      continue;
    }
    const byName = STATUS_NAME_TO_APP[row.name];
    if (byName) {
      map.set(row.id, byName);
      continue;
    }
    // Estado nuevo sin traducción explícita: lo mejor que podemos hacer sin
    // inventar nombres es caer al bucket "open"/"closed" genérico de osTicket.
    map.set(row.id, row.state === "open" ? "open" : row.state === "closed" ? "closed" : null);
  }
  return map;
}

// "Sitio de Aduana" (list_id=2) es el campo del formulario general de
// tickets. "CCTV Sitios" (list_id=7) es un campo aparte que solo llenan los
// tickets del departamento CCTV (ver loadCctvSiteNameByTicketId) — un mismo
// sitio puede tener IDs distintos en cada lista, por eso todo se resuelve
// por NOMBRE normalizado, nunca por ID.
const SITE_LIST_IDS = [2, 7];

async function loadListItemNamesById(): Promise<Map<number, string>> {
  const rows = await readOnlyQuery<{ id: number; value: string }>(
    `SELECT id, value FROM ost_list_items WHERE list_id IN (${SITE_LIST_IDS.join(",")})`
  );
  return new Map(rows.map((row) => [row.id, row.value]));
}

/** Tema de ayuda (ost_help_topic): la categoría con la que el solicitante abrió el ticket, distinta del departamento que termina atendiéndolo. */
async function loadHelpTopicNameById(): Promise<Map<number, string>> {
  const rows = await readOnlyQuery<{ topic_id: number; topic: string }>(
    "SELECT topic_id, topic FROM ost_help_topic"
  );
  return new Map(rows.map((row) => [row.topic_id, row.topic]));
}

function parseSingleValueJson(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const [name] = Object.values(parsed);
    return name ?? null;
  } catch {
    return null;
  }
}

/**
 * "cctv_sitios" es un campo de formulario dinámico (no una columna física de
 * ost_ticket__cdata): sus respuestas viven en ost_form_entry_values como
 * JSON {"<list_item_id>":"<nombre>"}. Se busca el campo por NOMBRE en
 * ost_form_field en vez de asumir un form_id/field_id fijo, para no
 * hardcodear un ID interno de este install en particular.
 */
async function loadCctvSiteNameByTicketId(): Promise<Map<number, string>> {
  const fieldRows = await readOnlyQuery<{ id: number; form_id: number }>(
    "SELECT id, form_id FROM ost_form_field WHERE name = 'cctv_sitios' LIMIT 1"
  );
  const field = fieldRows[0];
  if (!field) return new Map();

  const rows = await readOnlyQuery<{ ticketId: number; value: string | null }>(
    `SELECT fe.object_id AS ticketId, fev.value AS value
     FROM ost_form_entry fe
     JOIN ost_form_entry_values fev ON fev.entry_id = fe.id
     WHERE fe.form_id = ? AND fev.field_id = ?`,
    [field.form_id, field.id]
  );

  const map = new Map<number, string>();
  for (const row of rows) {
    const name = parseSingleValueJson(row.value);
    if (name) map.set(row.ticketId, name);
  }
  return map;
}

// Un par de nombres de departamento no calzan exactamente con el acento que
// usa la UI (ej. "Tecnologia" sin tilde en la base).
const DEPARTMENT_NAME_FIXES: Record<string, string> = {
  Tecnologia: "Tecnología",
};

interface TicketRow {
  ticketId: number;
  number: string | null;
  statusId: number;
  topicId: number | null;
  created: string; // raw MySQL "YYYY-MM-DD HH:MM:SS" (ver dateStrings en db.ts)
  lastupdate: string | null;
  slaDueRaw: string | null;
  subject: string | null;
  priorityRaw: string | null;
  aduanaRaw: string | null;
  departmentName: string | null;
  teamName: string | null;
  agentName: string | null;
  requesterName: string | null;
}

/**
 * Convierte un DATETIME crudo de MySQL a ISO 8601. Verificado directamente
 * contra el servidor real (NOW()/UTC_TIMESTAMP() comparados en el mismo
 * instante contra el reloj de este proceso): la base guarda sus timestamps
 * ya en UTC, así que basta con marcarlos como tales — nunca dejamos que el
 * driver los reinterprete con la timezone local del proceso de Node (eso
 * fue justo la causa del bug de reenvío duplicado en el poller, y también
 * desfasaba 6h todas las fechas mostradas en la UI).
 */
function mysqlDatetimeToIso(raw: string): string {
  return new Date(`${raw.replace(" ", "T")}Z`).toISOString();
}

/**
 * Extrae el ID numérico inicial del texto libre de cdata.aduana, que en la
 * base real viene como "3,El Amatillo" o, en tickets más viejos, como solo
 * "6" (sin nombre). Nunca se confía en el nombre que venga en ese texto.
 */
function extractAduanaId(raw: string | null): number | null {
  if (!raw) return null;
  const match = /^(\d+)/.exec(raw.trim());
  return match ? Number(match[1]) : null;
}

interface MapRowContext {
  listItemNamesById: Map<number, string>;
  cctvSiteNameByTicketId: Map<number, string>;
  statusAppById: Map<number, TicketStatus | null>;
  priorityAppById: Map<number, TicketPriority>;
  helpTopicNameById: Map<number, string>;
}

/**
 * Resuelve el sitio de un ticket por NOMBRE (nunca por ID: ver comentario en
 * SITE_LIST_IDS), y lo hace calzar con el nombre canónico ya configurado en
 * site-metadata.json si existe uno (comparación normalizada) — así un mismo
 * sitio escrito distinto en cada lista de osTicket ("El Poy" vs "EL Poy")
 * termina agrupado bajo un solo siteId. Si el sitio real de osTicket todavía
 * no tiene coordenadas asignadas, el ticket igual se resuelve con el nombre
 * crudo (no se pierde, solo no va a tener con qué pintarse en el mapa).
 */
function resolveSiteId(row: TicketRow, ctx: MapRowContext): string {
  const aduanaId = extractAduanaId(row.aduanaRaw);
  const rawName =
    (aduanaId !== null ? ctx.listItemNamesById.get(aduanaId) : undefined) ??
    ctx.cctvSiteNameByTicketId.get(row.ticketId);

  if (!rawName) return "";

  const configured = sitesRepository.findByNormalizedName(rawName);
  return configured ? configured.id : rawName;
}

/**
 * El número visible es ost_ticket.number (el que muestra osTicket), NUNCA
 * ticket_id: son contadores distintos (number sale de ost_sequence, ticket_id
 * es el AUTO_INCREMENT) y se desalinean cada vez que osTicket consume un
 * número sin llegar a guardar el ticket — pasó el 2026-09-20 (desde
 * ticket_id 1890 el number va +1) y antes, en 2024, iban -1. El link a
 * osTicket sí usa ticket_id, porque eso espera tickets.php?id=.
 */
export function toDisplayTicketId(number: string | null, ticketId: number): string {
  const trimmed = number?.trim().replace(/^0+(?=\d)/, "");
  return `TCK-${trimmed || ticketId}`;
}

/** Devuelve null si el ticket debe quedar fuera del dashboard (ver loadStatusAppById). */
function mapRow(row: TicketRow, ctx: MapRowContext): Ticket | null {
  const status = ctx.statusAppById.get(row.statusId) ?? null;
  if (!status) return null;

  const priorityId = row.priorityRaw ? parseInt(row.priorityRaw, 10) : NaN;
  const priority = ctx.priorityAppById.get(priorityId) ?? "normal";

  const departmentRaw = (row.departmentName ?? "").trim();
  const department = DEPARTMENT_NAME_FIXES[departmentRaw] ?? (departmentRaw || "Sin departamento");
  const helpTopic = (row.topicId ? ctx.helpTopicNameById.get(row.topicId) : undefined) ?? "Sin tema";
  const team = row.teamName?.trim() || "Sin equipo";
  const agent = row.agentName?.trim() || "Sin asignar";

  return {
    id: toDisplayTicketId(row.number, row.ticketId),
    subject: row.subject?.trim() || "(Sin asunto)",
    status,
    priority,
    department,
    helpTopic,
    team,
    agent,
    siteId: resolveSiteId(row, ctx),
    createdAt: mysqlDatetimeToIso(row.created),
    updatedAt: mysqlDatetimeToIso(row.lastupdate ?? row.created),
    slaDueAt: row.slaDueRaw ? mysqlDatetimeToIso(row.slaDueRaw) : null,
    requester: row.requesterName?.trim() || "Desconocido",
    osTicketUrl: OSTICKET_BASE_URL
      ? `${OSTICKET_BASE_URL}/scp/tickets.php?id=${row.ticketId}`
      : undefined,
  };
}

// WHERE 1=1 es a propósito: deja que tanto fetchAllTickets como el poller de
// liveSimulator.ts puedan agregar "AND ..." sin duplicar lógica de armado de
// SQL. El filtro de estado (excluir Archivado/Borrado) ya NO va acá: pasa a
// resolverse en JS vía loadStatusAppById, en vivo contra ost_ticket_status.
const TICKETS_SELECT = `
  SELECT
    t.ticket_id  AS ticketId,
    t.number     AS number,
    t.status_id  AS statusId,
    t.topic_id   AS topicId,
    t.created    AS created,
    t.lastupdate AS lastupdate,
    -- duedate: fecha de vencimiento fijada a mano, casi siempre null. Si no
    -- está, cae a est_duedate (la que osTicket calcula sola a partir del
    -- SLA asignado) — mismo criterio que usa el propio osTicket para decidir
    -- si un ticket está vencido.
    COALESCE(t.duedate, t.est_duedate) AS slaDueRaw,
    cd.subject   AS subject,
    cd.priority  AS priorityRaw,
    cd.aduana    AS aduanaRaw,
    d.name       AS departmentName,
    tm.name      AS teamName,
    -- NULLIF(TRIM(...), ''): un agente sin nombre cargado (raro, pero pasa
    -- con cuentas de staff viejas) no debe mostrarse como " " en blanco.
    NULLIF(TRIM(CONCAT(COALESCE(st.firstname, ''), ' ', COALESCE(st.lastname, ''))), '') AS agentName,
    u.name       AS requesterName
  FROM ost_ticket t
  LEFT JOIN ost_ticket__cdata cd ON cd.ticket_id = t.ticket_id
  LEFT JOIN ost_department d ON d.id = t.dept_id
  LEFT JOIN ost_team tm ON tm.team_id = t.team_id
  LEFT JOIN ost_staff st ON st.staff_id = t.staff_id
  LEFT JOIN ost_user u ON u.id = t.user_id
  WHERE 1=1
`;

async function loadMapRowContext(): Promise<MapRowContext> {
  const [listItemNamesById, cctvSiteNameByTicketId, statusAppById, priorityAppById, helpTopicNameById] =
    await Promise.all([
      loadListItemNamesById(),
      loadCctvSiteNameByTicketId(),
      loadStatusAppById(),
      loadPriorityAppById(),
      loadHelpTopicNameById(),
    ]);
  return { listItemNamesById, cctvSiteNameByTicketId, statusAppById, priorityAppById, helpTopicNameById };
}

/**
 * allowedDepartments filtra en el ORIGEN (WHERE d.name IN (...)), no
 * post-filtrado en JS — es el scoping de seguridad de allowedDepartments
 * (ver usersRepository.getAllowedDepartments), separado de TicketFilters
 * (los filtros que sí controla el cliente vía query string).
 */
async function fetchAllTickets(allowedDepartments?: string[] | null): Promise<Ticket[]> {
  let sql = `${TICKETS_SELECT} `;
  const params: unknown[] = [];
  if (allowedDepartments && allowedDepartments.length > 0) {
    sql += `AND d.name IN (${allowedDepartments.map(() => "?").join(",")}) `;
    params.push(...allowedDepartments);
  }
  sql += `ORDER BY t.created DESC`;

  const [rows, ctx] = await Promise.all([
    readOnlyQuery<TicketRow>(sql, params),
    loadMapRowContext(),
  ]);

  const tickets: Ticket[] = [];
  for (const row of rows) {
    const ticket = mapRow(row, ctx);
    if (ticket) tickets.push(ticket);
  }
  return tickets;
}

function matchesFilters(ticket: Ticket, filters: TicketFilters): boolean {
  if (filters.siteId && ticket.siteId !== filters.siteId) return false;
  if (filters.status && ticket.status !== filters.status) return false;
  if (filters.priority && ticket.priority !== filters.priority) return false;
  return true;
}

function isOpenStatus(status: TicketStatus): boolean {
  return status === "open";
}

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function dateKey(isoDate: string): string {
  return isoDate.slice(0, 10); // YYYY-MM-DD
}

/**
 * Capa de acceso a datos de tickets. Lee de la base real de osTicket
 * (solo lectura, vía readOnlyQuery) y traduce su esquema al modelo que ya
 * consume el frontend — rutas de Express y frontend no cambiaron.
 */
export interface TicketsRepository {
  findAll(filters?: TicketFilters, allowedDepartments?: string[] | null): Promise<Ticket[]>;
  getStats(allowedDepartments?: string[] | null): Promise<TicketStats>;
}

class MySqlTicketsRepository implements TicketsRepository {
  async findAll(filters: TicketFilters = {}, allowedDepartments: string[] | null = null): Promise<Ticket[]> {
    const tickets = await fetchAllTickets(allowedDepartments);
    return tickets.filter((ticket) => matchesFilters(ticket, filters));
  }

  async getStats(allowedDepartments: string[] | null = null): Promise<TicketStats> {
    const [tickets, sites] = await Promise.all([
      fetchAllTickets(allowedDepartments),
      Promise.resolve(sitesRepository.findAll()),
    ]);

    const byStatus = STATUSES.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<TicketStatus, number>);

    const byPriority = PRIORITIES.reduce((acc, priority) => {
      acc[priority] = 0;
      return acc;
    }, {} as Record<TicketPriority, number>);

    const bySiteMap = new Map<
      string,
      { total: number; open: number; urgenteOpen: number }
    >();
    sites.forEach((site) => bySiteMap.set(site.id, { total: 0, open: 0, urgenteOpen: 0 }));

    let totalOpen = 0;
    let totalUrgente = 0;
    let resolvedToday = 0;

    const trendMap = new Map<string, number>();
    for (let i = 0; i < TREND_DAYS; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trendMap.set(dateKey(d.toISOString()), 0);
    }

    for (const ticket of tickets) {
      byStatus[ticket.status] += 1;
      byPriority[ticket.priority] += 1;

      const siteEntry = bySiteMap.get(ticket.siteId);
      if (siteEntry) {
        siteEntry.total += 1;
        if (isOpenStatus(ticket.status)) {
          siteEntry.open += 1;
          if (ticket.priority === URGENTE_PRIORITY) siteEntry.urgenteOpen += 1;
        }
      }

      if (isOpenStatus(ticket.status)) {
        totalOpen += 1;
        if (ticket.priority === URGENTE_PRIORITY) totalUrgente += 1;
      }

      if (ticket.status === "resolved" && isToday(ticket.updatedAt)) {
        resolvedToday += 1;
      }

      const key = dateKey(ticket.createdAt);
      if (trendMap.has(key)) {
        trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
      }
    }

    const bySite = sites.map((site) => {
      const entry = bySiteMap.get(site.id) ?? { total: 0, open: 0, urgenteOpen: 0 };
      return {
        siteId: site.id,
        siteName: site.name,
        total: entry.total,
        open: entry.open,
        urgenteOpen: entry.urgenteOpen,
      };
    });

    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, count]) => ({ date, count }));

    return {
      total: tickets.length,
      byStatus,
      byPriority,
      bySite,
      totalOpen,
      totalUrgente,
      resolvedToday,
      trend,
    };
  }
}

export const ticketsRepository: TicketsRepository = new MySqlTicketsRepository();

// Reutilizados por el poller de socket.io (sockets/liveSimulator.ts) para no
// duplicar la lógica de mapeo DB -> Ticket. STATUS_NAME_TO_APP también la usa
// sockets/ticketEventsPoller.ts, para traducir por PALABRA (nunca por ID) el
// estado que loguea ost_thread_event — misma regla de oro que en el resto
// del archivo, una sola fuente de verdad para esa traducción.
export { TICKETS_SELECT, mapRow as mapTicketRow, loadMapRowContext, mysqlDatetimeToIso, STATUS_NAME_TO_APP };
export type { TicketRow, MapRowContext };
