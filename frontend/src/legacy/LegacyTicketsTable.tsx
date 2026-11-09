import { IconExternalLink } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { LegacySlaBar } from "./LegacySlaBar";
import { DepartmentIcon } from "./legacyDepartmentIcons";
import {
  formatDateTime,
  LEGACY_PRIORITY_RANK,
  PRIORITY_DOT_COLORS,
  PRIORITY_LABELS,
  STATUS_DOT_COLORS,
  STATUS_LABELS,
} from "./legacyLabels";
import { computeSlaPercentage } from "./legacySla";
import { priorityTint } from "../lib/priorityTint";
import { LegacySite, LegacyTicket, LegacyTicketPriority, LegacyTicketStatus } from "./types";

interface LegacyTicketsTableProps {
  tickets: LegacyTicket[];
  sites: LegacySite[];
  /** false cuando los datos vienen de un snapshot: el link a osTicket ya no es confiable. */
  showOsTicketLink?: boolean;
}

const PAGE_SIZE = 25;

const selectClasses =
  "rounded-md border border-line-control bg-surface-2 px-2 py-1.5 text-xs text-text-strong outline-none focus:border-accent-text";

export function LegacyTicketsTable({ tickets, sites, showOsTicketLink = true }: LegacyTicketsTableProps) {
  const [siteId, setSiteId] = useState<string>("all");
  const [status, setStatus] = useState<LegacyTicketStatus | "all">("all");
  const [priority, setPriority] = useState<LegacyTicketPriority | "all">("all");
  const [department, setDepartment] = useState<string>("all");
  const [team, setTeam] = useState<string>("all");
  const [agent, setAgent] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site) => map.set(site.id, site.name));
    return map;
  }, [sites]);

  // En vivo a partir de los tickets ya cargados (mismo criterio del proyecto:
  // nunca hardcodear estas listas) — así solo aparecen opciones que el
  // usuario autenticado realmente puede ver. Departamento -> equipo -> agente
  // es una cascada real de los DATOS (no un árbol fijo: un mismo equipo puede
  // tener tickets de varios departamentos), cada nivel se recorta según lo
  // que ya esté elegido en el nivel anterior.
  const departments = useMemo(() => {
    return Array.from(new Set(tickets.map((ticket) => ticket.department))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [tickets]);

  const teams = useMemo(() => {
    const scoped = department === "all" ? tickets : tickets.filter((t) => t.department === department);
    return Array.from(new Set(scoped.map((t) => t.team))).sort((a, b) => a.localeCompare(b));
  }, [tickets, department]);

  const agents = useMemo(() => {
    const scoped = tickets
      .filter((t) => department === "all" || t.department === department)
      .filter((t) => team === "all" || t.team === team);
    return Array.from(new Set(scoped.map((t) => t.agent))).sort((a, b) => a.localeCompare(b));
  }, [tickets, department, team]);

  const filtered = useMemo(() => {
    return tickets
      .filter((ticket) => (siteId === "all" ? true : ticket.siteId === siteId))
      .filter((ticket) => (status === "all" ? true : ticket.status === status))
      .filter((ticket) => (priority === "all" ? true : ticket.priority === priority))
      .filter((ticket) => (department === "all" ? true : ticket.department === department))
      .filter((ticket) => (team === "all" ? true : ticket.team === team))
      .filter((ticket) => (agent === "all" ? true : ticket.agent === agent))
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [tickets, siteId, status, priority, department, team, agent]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="rounded-card border border-line glass">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <h3 className="mr-2 text-sm font-bold text-text-strong">Tickets</h3>

        <select
          value={siteId}
          onChange={(event) => {
            setSiteId(event.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          className={selectClasses}
        >
          <option value="all">Todos los sitios</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as LegacyTicketStatus | "all");
            setVisibleCount(PAGE_SIZE);
          }}
          className={selectClasses}
        >
          <option value="all">Todos los estados</option>
          {(Object.keys(STATUS_LABELS) as LegacyTicketStatus[]).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(event) => {
            setPriority(event.target.value as LegacyTicketPriority | "all");
            setVisibleCount(PAGE_SIZE);
          }}
          className={selectClasses}
        >
          <option value="all">Todas las prioridades</option>
          {(Object.keys(PRIORITY_LABELS) as LegacyTicketPriority[]).map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABELS[value]}
            </option>
          ))}
        </select>

        <select
          value={department}
          onChange={(event) => {
            setDepartment(event.target.value);
            // Cambiar el departamento resetea equipo y agente: ambos son
            // subconjuntos del departamento elegido, mantener una selección
            // vieja podría dejar filtros "fantasma" que ya no aplican a nada.
            setTeam("all");
            setAgent("all");
            setVisibleCount(PAGE_SIZE);
          }}
          className={selectClasses}
        >
          <option value="all">Todos los departamentos</option>
          {departments.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={team}
          onChange={(event) => {
            setTeam(event.target.value);
            setAgent("all");
            setVisibleCount(PAGE_SIZE);
          }}
          className={selectClasses}
        >
          <option value="all">Todos los equipos</option>
          {teams.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={agent}
          onChange={(event) => {
            setAgent(event.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          className={selectClasses}
        >
          <option value="all">Todos los agentes</option>
          {agents.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <span className="ml-auto text-xs text-text-muted">
          {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="thin-scroll overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong text-[11px] uppercase tracking-[0.12em] text-text-label">
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Asunto</th>
              <th className="px-3 py-2 font-medium">Sitio</th>
              <th className="px-3 py-2 font-medium">Depto.</th>
              <th className="px-3 py-2 font-medium">Tema</th>
              <th className="px-3 py-2 font-medium">Equipo</th>
              <th className="min-w-[110px] px-3 py-2 font-medium">Estado</th>
              <th className="min-w-[110px] px-3 py-2 font-medium">Prioridad</th>
              <th className="px-3 py-2 font-medium">SLA</th>
              <th className="px-3 py-2 font-medium">Agente</th>
              <th className="px-3 py-2 font-medium">Solicitante</th>
              <th className="px-3 py-2 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((ticket) => (
              <tr
                key={ticket.id}
                className="h-11 border-b border-line hover:bg-surface-2"
                style={{ backgroundImage: priorityTint(LEGACY_PRIORITY_RANK[ticket.priority] ?? 3, "row") }}
              >
                <td className="px-3 py-2 font-mono text-xs text-text-muted">
                  {ticket.id}
                </td>
                <td className="max-w-[200px] truncate px-3 py-2 text-text-strong">
                  {showOsTicketLink && ticket.osTicketUrl ? (
                    <a
                      href={ticket.osTicketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-accent-text hover:underline"
                      title="Ver ticket en osTicket"
                    >
                      <span className="truncate">{ticket.subject}</span>
                      <IconExternalLink size={12} stroke={2} className="flex-shrink-0" />
                    </a>
                  ) : (
                    ticket.subject
                  )}
                </td>
                <td className="px-3 py-2 text-text-muted">
                  {siteNameById.get(ticket.siteId) ?? ticket.siteId}
                </td>
                <td className="px-3 py-2 text-text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <DepartmentIcon department={ticket.department} size={13} />
                    {ticket.department}
                  </span>
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 text-text-muted">
                  {ticket.helpTopic}
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 text-text-muted">
                  {ticket.team}
                </td>
                <td className="min-w-[110px] px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: STATUS_DOT_COLORS[ticket.status] }}
                    />
                    <span className="text-[13px] text-text-muted">
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </span>
                </td>
                <td className="min-w-[110px] px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: PRIORITY_DOT_COLORS[ticket.priority] }}
                    />
                    <span className="text-[13px] text-text-muted">
                      {PRIORITY_LABELS[ticket.priority]}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <LegacySlaBar percentage={computeSlaPercentage(ticket)} />
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 text-text-muted">{ticket.agent}</td>
                <td className="px-3 py-2 text-text-muted">{ticket.requester}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-text-muted">
                  {formatDateTime(ticket.createdAt)}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="px-3 py-8 text-center text-text-muted"
                >
                  No hay tickets que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {visibleCount < filtered.length && (
        <div className="border-t border-line p-3 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="rounded-md border border-line-control px-3 py-1.5 text-xs text-text-strong hover:bg-surface-2"
          >
            Ver más
          </button>
        </div>
      )}
    </div>
  );
}
