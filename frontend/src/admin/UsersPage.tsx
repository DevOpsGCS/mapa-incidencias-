import { IconKey, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { deleteUser, fetchAdminQueues, fetchDepartments, fetchUsers } from "../api/adminClient";
import { UnauthorizedError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { queueCellFor, unknownQueuesNotices } from "../lib/adminQueues";
import { SELECTION_STYLE_INSET } from "../lib/priorityTint";
import { commandState } from "../lib/userCommands";
import { AdminUserSummary, Catalog } from "../types";
import { Pill } from "./Pill";
import { FlyoutTab, UserFlyout } from "./UserFlyout";

type ViewTab = "all" | "admins" | "pending";

const VIEW_TABS: { id: ViewTab; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "admins", label: "Administradores" },
  { id: "pending", label: "Pendientes de colas" },
];

const GRID = "grid grid-cols-[28px_minmax(120px,1fr)_minmax(160px,1.3fr)_130px_minmax(160px,1.6fr)_minmax(120px,1fr)] items-center gap-3";

interface FlyoutState {
  /** null = usuario nuevo. */
  user: AdminUserSummary | null;
  tab: FlyoutTab;
}

function parseTab(value: string | null): ViewTab {
  return value === "admins" || value === "pending" ? value : "all";
}

function QueuesCell({ user }: { user: AdminUserSummary }) {
  const cell = queueCellFor(user.allowedQueues);
  const notices = unknownQueuesNotices(user.unknownQueues);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {cell.kind === "pending" ? (
        <Pill tone="pending">Pendiente de asignar colas</Pill>
      ) : cell.kind === "all" ? (
        <Pill>Todas</Pill>
      ) : (
        cell.queues.map((name) => <Pill key={name}>{name}</Pill>)
      )}
      {Array.isArray(notices) ? (
        notices.map((notice) => (
          <Pill key={notice.text} tone="error">
            {notice.text}
          </Pill>
        ))
      ) : (
        <Pill>{notices.text}</Pill>
      )}
    </div>
  );
}

export function UsersPage() {
  const { user: currentUser, clearSession } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewTab = parseTab(searchParams.get("tab"));
  const openParam = searchParams.get("open");

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);
  const [catalogQueues, setCatalogQueues] = useState<Catalog["queues"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  // La selección solo vale para lo que se ve: al cambiar de pestaña o de filtro se descarta.
  useEffect(() => {
    setSelected([]);
  }, [viewTab, filter]);
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      // Departamentos (osTicket) y colas (Mesa de Servicio) son fuentes opcionales: si una cae, el panel sigue funcionando.
      const [list, departmentsResult, queuesResult] = await Promise.all([
        fetchUsers(),
        fetchDepartments().then(
          (names) => ({ ok: true as const, names }),
          (err: unknown) => ({ ok: false as const, err })
        ),
        fetchAdminQueues().then(
          (queues) => ({ ok: true as const, queues }),
          (err: unknown) => ({ ok: false as const, err })
        ),
      ]);
      if (
        (!departmentsResult.ok && departmentsResult.err instanceof UnauthorizedError) ||
        (!queuesResult.ok && queuesResult.err instanceof UnauthorizedError)
      ) {
        clearSession();
        return;
      }
      setUsers(list);
      setSelected((prev) => prev.filter((name) => list.some((u) => u.username === name)));
      setDepartments(departmentsResult.ok ? departmentsResult.names : []);
      setDepartmentsError(
        departmentsResult.ok ? null : "No se pudo cargar la lista de departamentos (osTicket no disponible)."
      );
      setCatalogQueues(queuesResult.ok ? queuesResult.queues : null);
      setError(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    load();
  }, [load]);

  // ?open=<usuario> (buscador global): abre el flyout una vez cargada la lista y limpia el parámetro.
  useEffect(() => {
    if (!openParam || loading) return;
    const match = users.find((u) => u.username.toLowerCase() === openParam.toLowerCase());
    if (match) setFlyout({ user: match, tab: "account" });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("open");
        return next;
      },
      { replace: true }
    );
  }, [openParam, loading, users, setSearchParams]);

  const setViewTab = (tab: ViewTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "all") next.delete("tab");
        else next.set("tab", tab);
        return next;
      },
      { replace: true }
    );
  };

  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return users.filter((u) => {
      if (viewTab === "admins" && u.role !== "admin") return false;
      if (viewTab === "pending" && u.allowedQueues !== null) return false;
      return term === "" || u.username.toLowerCase().includes(term);
    });
  }, [users, viewTab, filter]);

  const commands = commandState(selected, users, currentUser?.username ?? "");
  const allVisibleSelected = visible.length > 0 && visible.every((u) => selected.includes(u.username));

  const toggleOne = (username: string) =>
    setSelected((prev) => (prev.includes(username) ? prev.filter((n) => n !== username) : [...prev, username]));
  const toggleAll = () =>
    setSelected(allVisibleSelected ? selected.filter((n) => !visible.some((u) => u.username === n)) : [
      ...new Set([...selected, ...visible.map((u) => u.username)]),
    ]);

  const handleUnauthorized = () => clearSession();

  const handleResetPassword = () => {
    const target = users.find((u) => u.username === selected[0]);
    if (target) setFlyout({ user: target, tab: "password" });
  };

  const handleDelete = async () => {
    if (!commands.delete.enabled) return;
    const list = selected.map((name) => `• ${name}`).join("\n");
    const message =
      selected.length === 1
        ? `¿Borrar el usuario "${selected[0]}"? No va a poder volver a loguearse.`
        : `¿Borrar ${selected.length} usuarios? No van a poder volver a loguearse.\n\n${list}`;
    if (!window.confirm(message)) return;

    setDeleting(true);
    setError(null);
    try {
      // En secuencia: si uno falla se corta y se informa cuál, sin tocar el resto.
      let done = 0;
      let failure: string | null = null;
      for (const name of selected) {
        try {
          await deleteUser(name);
          done += 1;
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            clearSession();
            return;
          }
          const detail = err instanceof Error ? err.message : "error desconocido";
          failure = `Se eliminaron ${done} de ${selected.length}; falló "${name}": ${detail}`;
          break;
        }
      }
      await load();
      if (failure) setError(failure);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-text-muted">Cargando...</p>;
  }

  const commandButton =
    "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-sm text-text transition-colors hover:bg-surface-2 hover:text-text-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text";

  return (
    <div>
      <div role="tablist" className="flex gap-1">
        {VIEW_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={viewTab === t.id}
            onClick={() => setViewTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              viewTab === t.id
                ? "border-accent text-text-strong"
                : "border-transparent text-text-muted hover:text-text-strong"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 pb-3">
        <button type="button" onClick={() => setFlyout({ user: null, tab: "account" })} className={commandButton}>
          <IconPlus size={15} stroke={2} />
          Agregar usuario
        </button>
        <button type="button" onClick={() => load()} className={commandButton}>
          <IconRefresh size={15} stroke={2} />
          Actualizar
        </button>
        <button type="button" disabled={!commands.resetPassword} onClick={handleResetPassword} className={commandButton}>
          <IconKey size={15} stroke={2} />
          Restablecer contraseña
        </button>
        <button
          type="button"
          disabled={!commands.delete.enabled || deleting}
          title={commands.delete.reason ?? undefined}
          onClick={handleDelete}
          className={commandButton}
        >
          <IconTrash size={15} stroke={2} />
          Eliminar
        </button>
        <div className="flex-1" />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por nombre"
          aria-label="Filtrar usuarios por nombre"
          className="h-8 w-56 rounded-[6px] bg-surface-2 px-2.5 text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-card bg-surface-2 px-4 py-2 text-sm text-[color:var(--data-p0-text)]">
          {error}
        </div>
      )}

      <div role="table" aria-label="Usuarios" className="glass mt-2 overflow-hidden rounded-card">
        <div
          role="row"
          className={`${GRID} px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-label`}
        >
          <input
            type="checkbox"
            aria-label="Seleccionar todos"
            checked={allVisibleSelected}
            onChange={toggleAll}
            className="h-3.5 w-3.5"
          />
          <span role="columnheader">Usuario</span>
          <span role="columnheader">Correo</span>
          <span role="columnheader">Rol</span>
          <span role="columnheader">Colas</span>
          <span role="columnheader">Departamentos</span>
        </div>

        {visible.length === 0 && <p className="px-3 py-6 text-sm text-text-muted">No hay usuarios para mostrar.</p>}

        {visible.map((u) => {
          const isSelected = selected.includes(u.username);
          const isSelf = u.username.toLowerCase() === currentUser?.username.toLowerCase();
          return (
            <div
              key={u.username}
              role="row"
              className={`${GRID} border-t border-line px-3 py-2.5 text-sm transition-colors hover:bg-surface-2`}
              style={isSelected ? SELECTION_STYLE_INSET : undefined}
            >
              <input
                type="checkbox"
                aria-label={`Seleccionar ${u.username}`}
                checked={isSelected}
                onChange={() => toggleOne(u.username)}
                className="h-3.5 w-3.5"
              />
              <span role="cell" className="min-w-0 truncate">
                <button
                  type="button"
                  onClick={() => setFlyout({ user: u, tab: "account" })}
                  className="text-accent-text hover:underline"
                >
                  {u.username}
                </button>
                {isSelf && <span className="ml-1.5 text-xs text-text-label">(tú)</span>}
              </span>
              <span role="cell" className="truncate text-text-muted">
                {u.email}
              </span>
              <span role="cell">
                {u.role === "admin" ? <Pill tone="accent">Administrador</Pill> : <Pill>Normal</Pill>}
              </span>
              <span role="cell">
                <QueuesCell user={u} />
              </span>
              <span role="cell" className="flex flex-wrap gap-1">
                {u.allowedDepartments.length === 0 ? (
                  <Pill>Todos</Pill>
                ) : (
                  u.allowedDepartments.map((name) => <Pill key={name}>{name}</Pill>)
                )}
              </span>
            </div>
          );
        })}
      </div>

      {flyout && (
        <UserFlyout
          key={`${flyout.user?.username ?? "__new__"}:${flyout.tab}`}
          user={flyout.user}
          initialTab={flyout.tab}
          departments={departments}
          departmentsError={departmentsError}
          catalogQueues={catalogQueues}
          onClose={() => setFlyout(null)}
          onSaved={load}
          onPartial={setError}
          onUnauthorized={handleUnauthorized}
        />
      )}
    </div>
  );
}
