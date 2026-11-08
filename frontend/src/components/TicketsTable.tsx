import { IconExternalLink } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { QueueTreeSelect } from "./QueueTreeSelect";
import { SlaBar } from "./SlaBar";
import { buildPriorityRankMap, UNKNOWN_PRIORITY_RANK } from "../lib/priorityRank";
import { matchesQueueFilter } from "../lib/queueFilter";
import { QueueIcon } from "../lib/queueIcons";
import { computeSlaPercentage } from "../lib/sla";
import { formatSvDateTime } from "../lib/svTime";
import { priorityColor, stateTypeColor } from "../lib/znunyColors";
import { Catalog, Site, Ticket } from "../types";

interface TicketsTableProps {
  tickets: Ticket[];
  sites: Site[];
  catalog: Catalog;
}

const PAGE_SIZE = 25;
const COLUMN_COUNT = 9;

const selectClasses =
  "rounded-md border border-[color:var(--glass-border)] bg-[#0b1220] px-2 py-1 text-xs text-[color:var(--text)]";

export function TicketsTable({ tickets, sites, catalog }: TicketsTableProps) {
  const [siteId, setSiteId] = useState<string>("all");
  const [state, setState] = useState<string>("all");
  const [priorityId, setPriorityId] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [service, setService] = useState<string>("all");
  const [queue, setQueue] = useState<string | null>(null);
  const [owner, setOwner] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const rankById = useMemo(() => buildPriorityRankMap(catalog), [catalog]);

  // Cola -> propietario es una cascada real de los DATOS: las opciones de
  // propietario son los owners de los tickets que pasan el filtro de cola.
  // Estado/prioridad/tipo/servicio salen del catálogo en vivo (nunca listas fijas).
  const owners = useMemo(() => {
    const scoped = tickets.filter((t) => matchesQueueFilter(t.queue, queue));
    return Array.from(new Set(scoped.map((t) => t.owner))).sort((a, b) => a.localeCompare(b));
  }, [tickets, queue]);

  const filtered = useMemo(() => {
    return tickets
      .filter((t) => (siteId === "all" ? true : t.siteId === siteId))
      .filter((t) => matchesQueueFilter(t.queue, queue))
      .filter((t) => (owner === "all" ? true : t.owner === owner))
      .filter((t) => (state === "all" ? true : t.state === state))
      .filter((t) => (priorityId === "all" ? true : t.priorityId === Number(priorityId)))
      .filter((t) => (type === "all" ? true : t.type === type))
      .filter((t) => (service === "all" ? true : t.service === service))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tickets, siteId, queue, owner, state, priorityId, type, service]);

  const visible = filtered.slice(0, visibleCount);

  const onFilter = (apply: () => void) => {
    apply();
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="glass-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--glass-border)] p-3">
        <h3 className="mono-label mr-2 text-[11px] text-[color:var(--muted)]">
          Tickets recientes
        </h3>

        <select
          value={siteId}
          onChange={(event) => onFilter(() => setSiteId(event.target.value))}
          className={selectClasses}
        >
          <option value="all">Todos los sitios</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>

        <QueueTreeSelect
          className="w-48"
          queues={catalog.queues}
          value={queue}
          onChange={(next) =>
            onFilter(() => {
              setQueue(next);
              // Cambiar la cola resetea el propietario: sus opciones salen de
              // la cola elegida, una selección vieja dejaría un filtro "fantasma".
              setOwner("all");
            })
          }
        />

        <select
          value={owner}
          onChange={(event) => onFilter(() => setOwner(event.target.value))}
          className={selectClasses}
        >
          <option value="all">Todos los propietarios</option>
          {owners.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={state}
          onChange={(event) => onFilter(() => setState(event.target.value))}
          className={selectClasses}
        >
          <option value="all">Todos los estados</option>
          {catalog.states.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={priorityId}
          onChange={(event) => onFilter(() => setPriorityId(event.target.value))}
          className={selectClasses}
        >
          <option value="all">Todas las prioridades</option>
          {[...catalog.priorities]
            .sort((a, b) => a.rank - b.rank)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>

        <select
          value={type}
          onChange={(event) => onFilter(() => setType(event.target.value))}
          className={selectClasses}
        >
          <option value="all">Todos los tipos</option>
          {catalog.types.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={service}
          onChange={(event) => onFilter(() => setService(event.target.value))}
          className={selectClasses}
        >
          <option value="all">Todos los servicios</option>
          {catalog.services.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <span className="mono-label ml-auto text-[10px] text-[color:var(--muted)]">
          {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="mono-label border-b border-[color:var(--glass-border)] text-[10px] text-[color:var(--muted)]">
              <th className="px-3 py-2 font-medium">TN</th>
              <th className="px-3 py-2 font-medium">Título</th>
              <th className="px-3 py-2 font-medium">Cola</th>
              <th className="min-w-[110px] px-3 py-2 font-medium">Estado</th>
              <th className="min-w-[110px] px-3 py-2 font-medium">Prioridad</th>
              <th className="px-3 py-2 font-medium">Propietario</th>
              <th className="px-3 py-2 font-medium">Sitio</th>
              <th className="px-3 py-2 font-medium">SLA</th>
              <th className="px-3 py-2 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((ticket) => (
              <tr
                key={ticket.id}
                className="border-b border-white/[0.04] hover:bg-white/[0.03]"
              >
                <td className="px-3 py-2 font-mono text-xs text-[color:var(--muted)]">
                  {ticket.tn}
                </td>
                <td className="max-w-xs truncate px-3 py-2 text-[color:var(--text)]">
                  <a
                    href={ticket.znunyUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 hover:text-[color:var(--cyan)] hover:underline"
                    title="Ver ticket en Znuny"
                  >
                    <span className="truncate">{ticket.title}</span>
                    <IconExternalLink size={12} stroke={2} className="flex-shrink-0" />
                  </a>
                </td>
                <td className="px-3 py-2 text-[color:var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <QueueIcon queue={ticket.queue} size={13} />
                    {ticket.queue}
                  </span>
                </td>
                <td className="min-w-[110px] px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: stateTypeColor(ticket.stateType) }}
                    />
                    <span className="text-[13px] text-[color:var(--muted)]">{ticket.state}</span>
                  </span>
                </td>
                <td className="min-w-[110px] px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: priorityColor(rankById.get(ticket.priorityId) ?? UNKNOWN_PRIORITY_RANK) }}
                    />
                    <span className="text-[13px] text-[color:var(--muted)]">{ticket.priority}</span>
                  </span>
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 text-[color:var(--muted)]">{ticket.owner}</td>
                <td className="px-3 py-2 text-[color:var(--muted)]">
                  {ticket.siteName ?? ticket.siteKey ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <SlaBar percentage={computeSlaPercentage(ticket)} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[color:var(--muted)]">
                  {formatSvDateTime(ticket.createdAt)}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMN_COUNT}
                  className="px-3 py-8 text-center text-[color:var(--muted)]"
                >
                  No hay tickets que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {visibleCount < filtered.length && (
        <div className="border-t border-[color:var(--glass-border)] p-3 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="mono-label rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[10px] text-[color:var(--text)] transition-colors hover:bg-white/[0.1]"
          >
            Ver más
          </button>
        </div>
      )}
    </div>
  );
}
