import { useEffect, useState } from "react";

interface SyncStatusProps {
  connected: boolean;
  lastHeartbeatAt: Date | null;
  /** false = el último latido avisó que el backend no pudo consultar la Mesa de Servicio. */
  serviceDeskOk: boolean;
}

// Si no llega un heartbeat en más de 2 ciclos de poll (backend: ~20s c/u),
// algo está trabado del lado del servidor aunque el socket siga conectado.
const STALE_AFTER_SECONDS = 50;

const NO_CONNECTION_LABEL = "Sin conexión con la Mesa de Servicio";

function formatAgo(seconds: number): string {
  if (seconds < 60) return `hace ${Math.max(seconds, 0)} s`;
  return `hace ${Math.floor(seconds / 60)} min`;
}

/** Indicador de sincronización: "late" con cada poll real del backend (haya o no cambios). */
export function SyncStatus({ connected, lastHeartbeatAt, serviceDeskOk }: SyncStatusProps) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const secondsSince = lastHeartbeatAt
    ? Math.floor((Date.now() - lastHeartbeatAt.getTime()) / 1000)
    : null;
  const isStale = secondsSince !== null && secondsSince > STALE_AFTER_SECONDS;

  let label: string;
  let color: string;
  let healthy = false;
  if (secondsSince === null && connected) {
    label = "Conectando…";
    color = "var(--text-muted)";
  } else if (secondsSince === null) {
    label = "Conectando…";
    color = "var(--data-p1)";
  } else if (!connected) {
    label = NO_CONNECTION_LABEL;
    color = "var(--data-p1)";
  } else if (!serviceDeskOk) {
    // El backend late pero no llega a la Mesa de Servicio (p. ej. túnel caído): no es "sano".
    label = NO_CONNECTION_LABEL;
    color = "var(--data-p0)";
  } else if (isStale) {
    label = formatAgo(secondsSince);
    color = "var(--data-p1)";
  } else {
    label = formatAgo(secondsSince);
    color = "var(--data-p3)";
    healthy = true;
  }

  return (
    <div
      className="flex h-9 items-center gap-2 rounded-[6px] border border-line-control px-3 font-mono text-[12px] text-text"
      title={!serviceDeskOk ? "El dashboard sigue conectado, pero no puede consultar la Mesa de Servicio" : undefined}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full" style={{ background: color }} />
        {healthy && (
          <span
            key={lastHeartbeatAt?.getTime()}
            className="heartbeat-blip absolute inline-flex h-full w-full rounded-full"
            style={{ background: color }}
          />
        )}
      </span>
      {label}
    </div>
  );
}
