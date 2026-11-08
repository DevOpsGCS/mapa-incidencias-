import { useEffect, useMemo, useRef, useState } from "react";
import { TicketNotification } from "../hooks/useDashboardData";
import { buildPriorityRankMap, UNKNOWN_PRIORITY_RANK } from "../lib/priorityRank";
import { QueueIcon } from "../lib/queueIcons";
import { priorityColor, stateTypeColor } from "../lib/znunyColors";
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
          priorityRank={rankById.get(notification.ticket.priorityId) ?? UNKNOWN_PRIORITY_RANK}
          onDismiss={() => onDismiss(notification.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  notification: TicketNotification;
  priorityRank: number;
  onDismiss: () => void;
}

function Toast({ notification, priorityRank, onDismiss }: ToastProps) {
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
  const borderColor = isStatusChange ? stateTypeColor(ticket.stateType) : priorityColor(priorityRank);
  const label = isStatusChange ? "Cambio de estado" : "Nuevo ticket";
  const metaLine = isStatusChange
    ? `${siteName} · ${previousState ? `de ${previousState} a ${ticket.state}` : ticket.state}`
    : `${siteName} · ${ticket.priority}`;
  const headline = `${ticket.tn} · ${ticket.title}`;

  return (
    <div
      className={`glass-panel pointer-events-auto flex items-start gap-4 border-l-[5px] px-6 py-5 shadow-2xl transition-all duration-300 ease-out ${
        visible ? "translate-x-0 opacity-100" : "translate-x-16 opacity-0"
      }`}
      style={{ borderLeftColor: borderColor }}
    >
      <div className="mt-0.5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
        <QueueIcon queue={ticket.queue} size={28} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mono-label text-sm" style={{ color: isStatusChange ? borderColor : "var(--cyan)" }}>
          {label}
        </p>
        {ticket.znunyUrl ? (
          <a
            href={ticket.znunyUrl}
            target="_blank"
            rel="noopener"
            className="mt-1 line-clamp-2 block text-xl font-medium text-[color:var(--text)] hover:text-[color:var(--cyan)] hover:underline"
            title="Ver ticket en Znuny"
          >
            {headline}
          </a>
        ) : (
          <p className="mt-1 line-clamp-2 text-xl font-medium text-[color:var(--text)]">
            {headline}
          </p>
        )}
        <p className="mono-label mt-1.5 text-sm text-[color:var(--muted)]">{metaLine}</p>
      </div>
      <button
        type="button"
        onClick={handleManualClose}
        className="flex-shrink-0 text-lg text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}
