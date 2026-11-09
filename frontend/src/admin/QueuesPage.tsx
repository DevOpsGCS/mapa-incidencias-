import { IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAdminQueues, fetchUsers } from "../api/adminClient";
import { fetchTickets, UnauthorizedError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { queueAccessCounts } from "../lib/queueAccessCounts";
import { AdminUserSummary, Catalog, Ticket } from "../types";

const GRID = "grid grid-cols-[minmax(200px,2fr)_minmax(120px,1fr)_minmax(140px,1fr)] items-center gap-3";

/** Vista de solo lectura del árbol de colas de la Mesa de Servicio. */
export function QueuesPage() {
  const { clearSession } = useAuth();
  const [queues, setQueues] = useState<Catalog["queues"]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [q, u, t] = await Promise.all([fetchAdminQueues(), fetchUsers(), fetchTickets()]);
      setQueues(q);
      setUsers(u);
      setTickets(t);
      setError(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo cargar la información de las colas.");
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => queueAccessCounts(queues, users, tickets), [queues, users, tickets]);

  if (loading) {
    return <p className="text-sm text-text-muted">Cargando...</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-sm text-text transition-colors hover:bg-surface-2 hover:text-text-strong"
        >
          <IconRefresh size={15} stroke={2} />
          Actualizar
        </button>
        <p className="ml-2 text-sm text-text-muted">
          Las colas se administran en la Mesa de Servicio; esta vista es de solo lectura.
        </p>
      </div>

      {error && (
        <div className="mt-3 rounded-card border border-line-strong bg-surface-2 px-4 py-2 text-sm text-[color:var(--data-p0-text)]">
          {error}
        </div>
      )}

      <div role="table" aria-label="Colas" className="mt-2">
        <div
          role="row"
          className={`${GRID} px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-label`}
        >
          <span role="columnheader">Cola</span>
          <span role="columnheader">Tickets abiertos</span>
          <span role="columnheader">Usuarios con acceso</span>
        </div>
        {rows.length === 0 && !error && <p className="px-3 py-6 text-sm text-text-muted">No hay colas para mostrar.</p>}
        {rows.map((row) => (
          <div
            key={row.name}
            role="row"
            className={`${GRID} border-t border-line px-3 py-2.5 text-sm transition-colors hover:bg-surface-2`}
          >
            <span role="cell" className="min-w-0 truncate text-text-strong" style={{ paddingLeft: row.depth * 20 }}>
              {row.name.split("::").pop()}
            </span>
            <span role="cell" className="font-mono text-text">
              {row.openTickets}
            </span>
            <span role="cell" className="font-mono text-text">
              {row.usersWithAccess}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
