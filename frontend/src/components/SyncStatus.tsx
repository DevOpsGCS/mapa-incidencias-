import { useEffect, useState } from "react";

interface SyncStatusProps {
  connected: boolean;
  lastHeartbeatAt: Date | null;
  /** false = el último latido avisó que el backend no pudo consultar Znuny. */
  serviceDeskOk: boolean;
}

function formatCounter(seconds: number): string {
  if (seconds < 1) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
}

// Si no llega un heartbeat en más de 2 ciclos de poll (backend: ~20s c/u),
// algo está trabado del lado del servidor aunque el socket siga conectado.
const STALE_AFTER_SECONDS = 50;

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
  if (!connected) {
    label = "--";
    color = "var(--muted)";
  } else if (secondsSince === null) {
    label = "--";
    color = "var(--muted)";
  } else if (!serviceDeskOk) {
    // El backend late pero no llega a Znuny (p. ej. túnel caído): no es "sano".
    label = "sin conexión con la mesa de servicio";
    color = "var(--red)";
  } else if (isStale) {
    label = formatCounter(secondsSince);
    color = "var(--amber)";
  } else {
    label = formatCounter(secondsSince);
    color = "var(--cyan)";
  }

  return (
    <div
      className="glass-panel mono-label flex items-center gap-2 rounded-full px-3.5 py-2 text-[11.5px]"
      style={{ color }}
      title={!serviceDeskOk ? "El dashboard sigue conectado, pero no puede consultar Znuny" : undefined}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="absolute inline-flex h-full w-full rounded-full"
          style={{ background: color }}
        />
        {connected && secondsSince !== null && !isStale && serviceDeskOk && (
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
