import { ServiceDeskLink } from "./ServiceDeskLink";
import { buildPriorityRankMap, UNKNOWN_PRIORITY_RANK } from "../lib/priorityRank";
import { priorityTextColor, priorityTint } from "../lib/priorityTint";
import { queueLabel } from "../lib/sitePanel";
import { formatSvDateTime } from "../lib/svTime";
import { stateTypeColor } from "../lib/znunyColors";
import { Catalog, Ticket } from "../types";

interface TicketDetailProps {
  ticket: Ticket | null;
  catalog: Catalog;
  emptyText?: string;
}

/** Detalle completo de un ticket; compartido por el panel del sitio y Métricas. */
export function TicketDetail({ ticket, catalog, emptyText = "Sin tickets con este filtro" }: TicketDetailProps) {
  if (!ticket) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-text-muted">
        {emptyText}
      </div>
    );
  }

  const rank = buildPriorityRankMap(catalog).get(ticket.priorityId) ?? UNKNOWN_PRIORITY_RANK;
  const fields: [string, string][] = [
    ["Cola", queueLabel(ticket.queue)],
    ["Tipo", ticket.type ?? "—"],
    ["Servicio", ticket.service ?? "—"],
    ["Propietario", ticket.owner],
    ["Responsable", ticket.responsible ?? "—"],
    ["Cliente", ticket.customer],
    ["Creado", formatSvDateTime(ticket.createdAt)],
    ["Vencimiento SLA", ticket.slaDueAt ? formatSvDateTime(ticket.slaDueAt) : "—"],
  ];

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div>
        <p className="mono-label mb-1 text-[11px] text-text-label" style={{ letterSpacing: "0.12em" }}>
          {ticket.tn}
        </p>
        <h3 className="text-[17px] font-bold leading-snug text-text-strong">{ticket.title}</h3>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="mono-label rounded px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundImage: priorityTint(rank, "card"), color: priorityTextColor(rank) }}
        >
          {ticket.priority}
        </span>
        <span className="mono-label inline-flex items-center gap-1.5 rounded bg-surface-3 px-2 py-0.5 text-xs text-text">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: stateTypeColor(ticket.stateType) }}
            aria-hidden
          />
          {ticket.state}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="mono-label text-[11px] text-text-label" style={{ letterSpacing: "0.12em" }}>
              {label}
            </dt>
            <dd className="break-words text-sm text-text-strong">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto">
        <ServiceDeskLink href={ticket.znunyUrl} variant="full" />
      </div>
    </div>
  );
}
