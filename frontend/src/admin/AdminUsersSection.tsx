import { IconEdit, IconKey, IconTrash, IconUserPlus } from "@tabler/icons-react";
import { FormEvent, useEffect, useState } from "react";
import {
  createUser,
  deleteUser,
  fetchAdminQueues,
  fetchDepartments,
  fetchUsers,
  setUserPassword,
  setUserRole,
  updateUserProfile,
} from "../api/adminClient";
import { UnauthorizedError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PasswordInput } from "../components/PasswordInput";
import { QueueTreeSelect } from "../components/QueueTreeSelect";
import {
  buildQueuesPayload,
  mergeKnownSelection,
  modeFromAllowedQueues,
  QueueAccessMode,
  queueCellFor,
  queuesChanged,
  splitSelectedQueues,
  unknownQueuesNotices,
} from "../lib/adminQueues";
import { AdminUserSummary, Catalog, Role } from "../types";
import { Badge } from "./Badge";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  normal: "Usuario",
};

interface CreateFormState {
  username: string;
  email: string;
  password: string;
  role: Role;
  allowedDepartments: string[];
  queueMode: QueueAccessMode;
  queues: string[];
}

interface EditFormState {
  originalUsername: string;
  username: string;
  email: string;
  allowedDepartments: string[];
  queueMode: QueueAccessMode;
  queues: string[];
  /** allowedQueues tal como está guardado; si no cambia no se envía en el PATCH. */
  originalQueues: string[] | null;
}

interface PasswordFormState {
  username: string;
  password: string;
}

interface DepartmentsCheckboxGroupProps {
  departments: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

/** Ninguno marcado = sin restricción (ve todos los departamentos) — mismo criterio que el backend. */
function DepartmentsCheckboxGroup({ departments, selected, onChange }: DepartmentsCheckboxGroupProps) {
  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((d) => d !== name) : [...selected, name]);
  };

  if (departments.length === 0) {
    return <p className="mt-1 text-sm text-[color:var(--text-disabled)]">No hay departamentos disponibles.</p>;
  }

  return (
    <div className="mt-1 max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-[color:var(--glass-border)] bg-black/20 p-2.5">
      {departments.map((name) => (
        <label key={name} className="flex items-center gap-2 text-sm text-[color:var(--text)]">
          <input
            type="checkbox"
            checked={selected.includes(name)}
            onChange={() => toggle(name)}
            className="h-3.5 w-3.5"
          />
          {name}
        </label>
      ))}
    </div>
  );
}

interface QueueAccessFieldProps {
  mode: QueueAccessMode;
  selected: string[];
  /** null = el catálogo de colas no se pudo cargar (Znuny no disponible). */
  catalogQueues: Catalog["queues"] | null;
  onModeChange: (mode: QueueAccessMode) => void;
  onSelectedChange: (next: string[]) => void;
}

const QUEUE_MODE_OPTIONS: { mode: QueueAccessMode; label: string }[] = [
  { mode: "all", label: "Todas las colas" },
  { mode: "specific", label: "Colas específicas" },
  { mode: "none", label: "Sin acceso" },
];

function QueueAccessField({ mode, selected, catalogQueues, onModeChange, onSelectedChange }: QueueAccessFieldProps) {
  const { known, unknown } = splitSelectedQueues(selected, catalogQueues);
  return (
    <div className="block text-sm text-[color:var(--text-secondary)]">
      Colas de Znuny
      <div className="mt-1 space-y-1.5">
        {QUEUE_MODE_OPTIONS.map((option) => (
          <label key={option.mode} className="flex items-center gap-2 text-sm text-[color:var(--text)]">
            <input
              type="radio"
              name="queue-access-mode"
              checked={mode === option.mode}
              onChange={() => onModeChange(option.mode)}
              className="h-3.5 w-3.5"
            />
            {option.label}
          </label>
        ))}
      </div>
      {mode === "specific" && unknown.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unknown.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded border border-[#FF4D6D]/40 px-2 py-0.5 text-xs text-[#FF718A]"
            >
              Cola inexistente: {name}
              <button
                type="button"
                onClick={() => onSelectedChange(selected.filter((q) => q !== name))}
                aria-label={`Quitar ${name}`}
                title="Quitar"
                className="hover:text-white"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {mode === "specific" &&
        (catalogQueues ? (
          <QueueTreeSelect
            multiple
            queues={catalogQueues}
            value={known}
            onChange={(next) => onSelectedChange(mergeKnownSelection(unknown, next))}
            placeholder="Elegí las colas"
            className="mt-2"
          />
        ) : (
          <p className="mt-2 text-sm text-[color:var(--text-disabled)]">
            No se pudo cargar el catálogo de colas (Znuny no disponible).
          </p>
        ))}
      {mode === "none" && (
        <p className="mt-2 text-xs text-[color:var(--text-disabled)]">
          El usuario no verá tickets de Znuny hasta que se le asignen colas.
        </p>
      )}
    </div>
  );
}

function QueuesCell({ user }: { user: AdminUserSummary }) {
  const cell = queueCellFor(user.allowedQueues);
  const notices = unknownQueuesNotices(user.unknownQueues);
  return (
    <div className="flex flex-col items-start gap-1">
      {cell.kind === "pending" ? (
        <Badge>Pendiente de asignar colas</Badge>
      ) : cell.kind === "all" ? (
        <Badge>Todas</Badge>
      ) : (
        <div className="flex flex-wrap gap-1">
          {cell.queues.map((name) => (
            <Badge key={name}>{name}</Badge>
          ))}
        </div>
      )}
      {Array.isArray(notices) ? (
        notices.map((notice) => (
          <span key={notice.text} className="text-xs text-[#FF718A]">
            {notice.text}
          </span>
        ))
      ) : (
        <span className="text-xs text-[color:var(--text-disabled)]">{notices.text}</span>
      )}
    </div>
  );
}

export function AdminUsersSection() {
  const { user: currentUser, clearSession } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);
  const [catalogQueues, setCatalogQueues] = useState<Catalog["queues"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const load = async () => {
    try {
      // Departamentos (osTicket) y colas (Znuny) son fuentes opcionales: si una cae, el panel de usuarios sigue funcionando.
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
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateForm = () => {
    setCreateError(null);
    setCreateForm({
      username: "",
      email: "",
      password: "",
      role: "normal",
      allowedDepartments: [],
      // Un usuario nuevo arranca sin acceso a Znuny hasta que se le asignen colas.
      queueMode: "none",
      queues: [],
    });
  };

  const handleCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!createForm) return;
    if (createForm.password.length < 8) {
      setCreateError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    const queuesPayload = buildQueuesPayload(createForm.queueMode, createForm.queues);
    if (!queuesPayload.ok) {
      setCreateError(queuesPayload.error);
      return;
    }

    setSaving(true);
    setCreateError(null);
    try {
      await createUser({
        username: createForm.username,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        // Si osTicket no respondió, no se envía: el backend no debe revalidar contra una base caída.
        ...(departmentsError ? {} : { allowedDepartments: createForm.allowedDepartments }),
        allowedQueues: queuesPayload.value,
      });
      setCreateForm(null);
      await load();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setCreateError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (username: string, role: Role) => {
    try {
      await setUserRole(username, role);
      await load();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo cambiar el rol.");
    }
  };

  const openEditForm = (u: AdminUserSummary) => {
    setEditError(null);
    setEditForm({
      originalUsername: u.username,
      username: u.username,
      email: u.email,
      allowedDepartments: u.allowedDepartments,
      queueMode: modeFromAllowedQueues(u.allowedQueues),
      queues: u.allowedQueues ?? [],
      originalQueues: u.allowedQueues,
    });
  };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editForm) return;

    const queuesPayload = buildQueuesPayload(editForm.queueMode, editForm.queues);
    if (!queuesPayload.ok) {
      setEditError(queuesPayload.error);
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      await updateUserProfile(editForm.originalUsername, {
        username: editForm.username,
        email: editForm.email,
        // Con la lista caída el admin no puede cambiarlos: no se envía y se conservan los actuales.
        ...(departmentsError ? {} : { allowedDepartments: editForm.allowedDepartments }),
        // Sin cambios no se envía: el backend validaría las colas contra Znuny
        // y con Znuny caído no se podría editar ni el email.
        ...(queuesChanged(editForm.originalQueues, queuesPayload.value)
          ? { allowedQueues: queuesPayload.value }
          : {}),
      });
      setEditForm(null);
      await load();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setEditError(err instanceof Error ? err.message : "No se pudo guardar los cambios.");
    } finally {
      setEditSaving(false);
    }
  };

  const openPasswordForm = (u: AdminUserSummary) => {
    setPasswordError(null);
    setPasswordForm({ username: u.username, password: "" });
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordForm) return;
    if (passwordForm.password.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await setUserPassword(passwordForm.username, passwordForm.password);
      setPasswordForm(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setPasswordError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (!window.confirm(`¿Borrar el usuario "${username}"? No va a poder volver a loguearse.`)) {
      return;
    }
    try {
      await deleteUser(username);
      await load();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo borrar el usuario.");
    }
  };

  if (loading) {
    return <p className="text-sm text-[color:var(--text-secondary)]">Cargando...</p>;
  }

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-[color:var(--text)]">Usuarios</h2>
        <button
          type="button"
          onClick={openCreateForm}
          className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-[color:var(--text)] hover:bg-white/15"
        >
          <IconUserPlus size={14} stroke={2} />
          Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[#FF4D6D]/40 bg-[#2a0f16]/90 px-4 py-2 text-sm text-[#ff8fa3]">
          {error}
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="mono-label text-[10px] text-[color:var(--text-secondary)]">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Colas</th>
                <th className="px-4 py-3 font-medium">Departamentos</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.username.toLowerCase() === currentUser?.username.toLowerCase();
                const isLastAdmin = u.role === "admin" && adminCount <= 1;
                const deleteDisabled = isSelf || isLastAdmin;
                const deleteTitle = isSelf
                  ? "No podés borrar tu propia cuenta"
                  : isLastAdmin
                    ? "No se puede borrar al único administrador"
                    : "Borrar";

                return (
                  <tr
                    key={u.username}
                    className="border-t border-[color:var(--glass-border)] transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-2.5 text-[color:var(--text)]">
                      {u.username}
                      {isSelf && (
                        <span className="mono-label ml-1.5 text-[9px] text-[color:var(--text-disabled)]">
                          (tú)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--text-secondary)]">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.username, e.target.value as Role)}
                        className="mono-label rounded bg-transparent px-2 py-0.5 text-[10px] font-medium outline-none"
                        style={{
                          border: `0.5px solid ${u.role === "admin" ? "var(--border-accent)" : "var(--border-strong)"}`,
                          color: u.role === "admin" ? "var(--text-accent)" : "var(--text-secondary)",
                        }}
                      >
                        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                          <option key={role} value={role} className="bg-[#0b1220] text-[color:var(--text)]">
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <QueuesCell user={u} />
                    </td>
                    <td className="px-4 py-2.5">
                      {u.allowedDepartments.length === 0 ? (
                        <Badge>Todos</Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.allowedDepartments.map((name) => (
                            <Badge key={name}>{name}</Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openEditForm(u)}
                        aria-label={`Editar ${u.username}`}
                        title="Editar usuario"
                        className="mr-2 rounded p-1 text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text)]"
                      >
                        <IconEdit size={15} stroke={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openPasswordForm(u)}
                        aria-label={`Cambiar contraseña de ${u.username}`}
                        title="Cambiar contraseña"
                        className="mr-2 rounded p-1 text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text)]"
                      >
                        <IconKey size={15} stroke={2} />
                      </button>
                      <button
                        type="button"
                        onClick={deleteDisabled ? undefined : () => handleDelete(u.username)}
                        disabled={deleteDisabled}
                        aria-label={`Borrar ${u.username}`}
                        title={deleteTitle}
                        className={`rounded p-1 transition-colors disabled:cursor-not-allowed ${
                          deleteDisabled
                            ? "text-[color:var(--text-disabled)]"
                            : "text-[color:var(--text-secondary)] hover:text-[#FF718A]"
                        }`}
                      >
                        <IconTrash size={15} stroke={2} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {createForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleCreateSubmit} className="glass-panel w-full max-w-sm space-y-4 p-6">
            <h3 className="font-display text-base font-semibold text-[color:var(--text)]">Nuevo usuario</h3>

            <label className="block text-sm text-[color:var(--text-secondary)]">
              Usuario
              <input
                type="text"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                required
                autoFocus
                className="mt-1 w-full rounded-md border border-[color:var(--glass-border)] bg-black/20 px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
              />
            </label>

            <label className="block text-sm text-[color:var(--text-secondary)]">
              Email
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
                className="mt-1 w-full rounded-md border border-[color:var(--glass-border)] bg-black/20 px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
              />
            </label>

            <label className="block text-sm text-[color:var(--text-secondary)]">
              Contraseña inicial
              <PasswordInput
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required
                minLength={8}
                className="rounded-md border border-[color:var(--glass-border)] bg-black/20 px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
              />
            </label>

            <label className="block text-sm text-[color:var(--text-secondary)]">
              Rol
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
                className="mt-1 w-full rounded-md border border-[color:var(--glass-border)] bg-[#0b1220] px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>

            <div className="block text-sm text-[color:var(--text-secondary)]">
              Departamentos (histórico osTicket)
              {departmentsError && <span className="mt-1 block text-xs text-[#FF718A]">{departmentsError}</span>}
              {departmentsError && (
                <span role="note" className="mt-1 block text-xs text-[#F7B84F]">
                  Sin la lista de departamentos el usuario se crea sin restricción: verá todo el
                  histórico de osTicket. Podés restringirlo editándolo cuando la lista vuelva a cargar.
                </span>
              )}
              <DepartmentsCheckboxGroup
                departments={departments}
                selected={createForm.allowedDepartments}
                onChange={(next) => setCreateForm({ ...createForm, allowedDepartments: next })}
              />
            </div>

            <QueueAccessField
              mode={createForm.queueMode}
              selected={createForm.queues}
              catalogQueues={catalogQueues}
              onModeChange={(queueMode) => setCreateForm({ ...createForm, queueMode })}
              onSelectedChange={(queues) => setCreateForm({ ...createForm, queues })}
            />

            {createError && <p className="text-sm text-[#FF718A]">{createError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateForm(null)}
                className="rounded-md bg-white/5 px-3 py-1.5 text-sm text-[color:var(--text)] hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-[color:var(--text)] hover:bg-white/15 disabled:opacity-50"
              >
                {saving ? "Creando..." : "Crear"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleEditSubmit} className="glass-panel w-full max-w-sm space-y-4 p-6">
            <h3 className="font-display text-base font-semibold text-[color:var(--text)]">
              Editar {editForm.originalUsername}
            </h3>

            <label className="block text-sm text-[color:var(--text-secondary)]">
              Usuario
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                required
                autoFocus
                className="mt-1 w-full rounded-md border border-[color:var(--glass-border)] bg-black/20 px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
              />
            </label>

            <label className="block text-sm text-[color:var(--text-secondary)]">
              Email
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
                className="mt-1 w-full rounded-md border border-[color:var(--glass-border)] bg-black/20 px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
              />
            </label>

            <div className="block text-sm text-[color:var(--text-secondary)]">
              Departamentos (histórico osTicket)
              {departmentsError && <span className="mt-1 block text-xs text-[#FF718A]">{departmentsError}</span>}
              {departmentsError ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {editForm.allowedDepartments.length === 0 ? (
                    <Badge>Todos</Badge>
                  ) : (
                    editForm.allowedDepartments.map((name) => <Badge key={name}>{name}</Badge>)
                  )}
                </div>
              ) : (
                <DepartmentsCheckboxGroup
                  departments={departments}
                  selected={editForm.allowedDepartments}
                  onChange={(next) => setEditForm({ ...editForm, allowedDepartments: next })}
                />
              )}
            </div>

            <QueueAccessField
              mode={editForm.queueMode}
              selected={editForm.queues}
              catalogQueues={catalogQueues}
              onModeChange={(queueMode) => setEditForm({ ...editForm, queueMode })}
              onSelectedChange={(queues) => setEditForm({ ...editForm, queues })}
            />

            {editError && <p className="text-sm text-[#FF718A]">{editError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditForm(null)}
                className="rounded-md bg-white/5 px-3 py-1.5 text-sm text-[color:var(--text)] hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-[color:var(--text)] hover:bg-white/15 disabled:opacity-50"
              >
                {editSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {passwordForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handlePasswordSubmit} className="glass-panel w-full max-w-sm space-y-4 p-6">
            <h3 className="font-display text-base font-semibold text-[color:var(--text)]">
              Cambiar contraseña de {passwordForm.username}
            </h3>

            <label className="block text-sm text-[color:var(--text-secondary)]">
              Contraseña nueva
              <PasswordInput
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                required
                autoFocus
                minLength={8}
                className="rounded-md border border-[color:var(--glass-border)] bg-black/20 px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
              />
            </label>

            {passwordError && <p className="text-sm text-[#FF718A]">{passwordError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasswordForm(null)}
                className="rounded-md bg-white/5 px-3 py-1.5 text-sm text-[color:var(--text)] hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-[color:var(--text)] hover:bg-white/15 disabled:opacity-50"
              >
                {passwordSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
