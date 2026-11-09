import { useEffect, useMemo, useRef, useState } from "react";
import { TicketNotification } from "../hooks/useDashboardData";
import { buildPriorityRankMap, UNKNOWN_PRIORITY_RANK } from "../lib/priorityRank";
import { priorityTextColor, priorityTint } from "../lib/priorityTint";
import { queueLabel } from "../lib/sitePanel";
import { stateTypeColor } from "../lib/znunyColors";
import { ServiceDeskLink } from "./ServiceDeskLink";
import { Catalog } from "../types";

interface NotificationStackProps {
  notifications: TicketNotification[];
  /** null mientras carga el catálogo: las prioridades caen al color del rank más bajo. */
  catalog: Catalog | null;
  onDismiss: (id: string) => void;
}

const VISIBLE_DURATION_MS = 12000;
const EXIT_DURATION_MS = 300;

/** Banner "ticket entrante"/"cambio de estado": aparece con ticket:new o ticket:status_changed y se auto-oculta a los pocos segundos. */
export function NotificationStack({ notifications, catalog, onDismiss }: NotificationStackProps) {
  const rankById = useMemo(() => buildPriorityRankMap(catalog), [catalog]);

  if (notifications.length === 0) return null;

  return (
    <div className="hud-scale pointer-events-none fixed right-[320px] top-[90px] z-[25] flex w-full max-w-xl flex-col gap-3 px-4">
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          catalog={catalog}
          priorityRank={rankById.get(notification.ticket.priorityId) ?? UNKNOWN_PRIORITY_RANK}
          onDismiss={() => onDismiss(notification.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  notification: TicketNotification;
  catalog: Catalog | null;
  priorityRank: number;
  onDismiss: () => void;
}

function Toast({ notification, catalog, priorityRank, onDismiss }: ToastProps) {
  const { ticket, kind, previousState } = notification;
  const siteName = ticket.siteName ?? ticket.siteKey ?? "Sin sitio";
  const [visible, setVisible] = useState(false);
  const removeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // setTimeout, no requestAnimationFrame: rAF queda completamente pausado
    // mientras la pestaña está en segundo plano (dashboard con otra ventana
    // encima, minimizado, etc.), así que el toast nunca llegaba a
    // "visible" y se autodestruía sin haberse mostrado nunca.
    const enterTimer = setTimeout(() => setVisible(true), 20);
    const exitTimer = setTimeout(() => close(), VISIBLE_DURATION_MS);

    function close() {
      setVisible(false);
      removeTimer.current = setTimeout(onDismiss, EXIT_DURATION_MS);
    }

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(removeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualClose = () => {
    clearTimeout(removeTimer.current);
    setVisible(false);
    removeTimer.current = setTimeout(onDismiss, EXIT_DURATION_MS);
  };

  const isStatusChange = kind === "status_changed";
  const headline = ticket.title;

  const stateTag = (name: string, color: string) => (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color, background: "var(--surface-1)", border: `1px solid ${color}` }}
    >
      {name}
    </span>
  );
  const colorOfStateName = (name: string): string => {
    const found = catalog?.states.find((s) => s.name === name);
    return found ? stateTypeColor(found.type) : "var(--text-muted)";
  };

  return (
    <div
      className={`pointer-events-auto w-[400px] max-w-full px-4 py-3.5 transition-all duration-300 ease-out ${
        visible ? "translate-x-0 opacity-100" : "translate-x-16 opacity-0"
      }`}
      style={{
        background: `${priorityTint(priorityRank, "card")}, var(--surface-3)`,
        borderRadius: 16,
        boxShadow: "0 8px 30px rgba(0,0,0,.45)",
      }}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-mono text-[10px] uppercase tracking-[.12em] text-text-label">
          <span style={{ color: priorityTextColor(priorityRank) }}>{ticket.priority}</span>
          {" · "}
          {isStatusChange ? "Cambió de estado" : "Ticket nuevo"}
          {" · "}
          {siteName}
        </p>
        <button
          type="button"
          onClick={handleManualClose}
          className="flex-shrink-0 text-sm leading-none text-text-label transition-colors hover:text-text-strong"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
      <p className="mt-2 line-clamp-2 text-[15px] font-bold text-text-strong">{headline}</p>
      <p className="mt-1 text-xs text-text-muted">
        {ticket.tn} · {queueLabel(ticket.queue)}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {isStatusChange ? (
            <>
              {previousState ? (
                <>
                  {stateTag(previousState, colorOfStateName(previousState))}
                  <span className="text-xs text-text-muted">→</span>
                </>
              ) : null}
              {stateTag(ticket.state, stateTypeColor(ticket.stateType))}
            </>
          ) : (
            stateTag(ticket.state, stateTypeColor(ticket.stateType))
          )}
        </div>
        {ticket.znunyUrl ? (
          <ServiceDeskLink href={ticket.znunyUrl} variant={isStatusChange ? "short" : "full"} />
        ) : null}
      </div>
    </div>
  );
}
