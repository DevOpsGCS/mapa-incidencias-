import { ReactNode, useCallback, useEffect, useState } from "react";
import { AdminStatus, fetchAdminStatus } from "../api/adminClient";
import { formatSvDateTime } from "../lib/svTime";
import { describeStatus, secondsSince, StatusTone } from "../lib/statusView";

const REFRESH_MS = 15_000;

const TONE_DOT: Record<StatusTone, string> = {
  ok: "var(--data-p3)",
  warn: "var(--data-p1)",
  error: "var(--data-p0)",
};

function StatusCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-line glass p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-label">{title}</div>
      <div className="mt-3 space-y-2 text-sm text-text">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-text-muted">{label}</span>
      <span className="text-right text-text-strong">{value}</span>
    </div>
  );
}

function ago(iso: string | null, now: Date): string {
  const s = secondsSince(iso, now);
  return s === null ? "sin datos" : `hace ${s} s`;
}

export function StatusPage() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchAdminStatus();
      setStatus(s);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setNow(new Date());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const view = status ? describeStatus(status, now) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div role="status" className="flex items-center gap-2 text-base font-medium text-text-strong">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: view ? TONE_DOT[view.tone] : "var(--text-faint)" }}
          />
          {view ? view.headline : failed ? "No se pudo consultar el estado" : "Consultando…"}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-full bg-accent-fill px-4 py-1.5 text-sm font-medium text-text-strong disabled:opacity-60"
        >
          {loading ? "Probando…" : "Probar conexión"}
        </button>
      </div>

      {failed && !status && (
        <p className="text-xs" style={{ color: "var(--data-p0-text)" }}>
          No se pudo obtener el estado del servidor. Reintentando automáticamente.
        </p>
      )}

      {status && view && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatusCard title="Mesa de Servicio">
            <Row label="Estado" value={view.headline} />
            <Row label="Latencia" value={status.serviceDesk.latencyMs === null ? "—" : `${status.serviceDesk.latencyMs} ms`} />
            <Row label="Último OK de tickets" value={ago(status.serviceDesk.ticketPoller.lastOkAt, now)} />
            <Row label="Último OK de estados" value={ago(status.serviceDesk.statePoller.lastOkAt, now)} />
            {view.lines
              .filter((l) => l.startsWith("Último error"))
              .map((l) => (
                <p key={l} className="break-words text-xs" style={{ color: "var(--data-p0-text)" }}>
                  {l}
                </p>
              ))}
          </StatusCard>
          <StatusCard title="Histórico">
            <Row label="Fuente" value={status.legacy.source === "live" ? "En vivo" : "Congelado"} />
            <Row label="Congelado el" value={status.legacy.frozenAt ? formatSvDateTime(status.legacy.frozenAt) : "—"} />
            <Row label="Total de tickets" value={status.legacy.total ?? "—"} />
          </StatusCard>
          <StatusCard title="Servidor">
            <Row label="Versión" value={status.server.version} />
            <Row label="En línea desde" value={formatSvDateTime(status.server.startedAt)} />
          </StatusCard>
        </div>
      )}
    </div>
  );
}
