import { FormEvent, useState } from "react";
import { createUser, setUserPassword, setUserRole, updateUserProfile } from "../api/adminClient";
import { UnauthorizedError } from "../api/client";
import { PasswordInput } from "../components/PasswordInput";
import { QueueTreeSelect } from "../components/QueueTreeSelect";
import { SidePanel } from "../components/SidePanel";
import {
  buildQueuesPayload,
  mergeKnownSelection,
  modeFromAllowedQueues,
  QueueAccessMode,
  splitSelectedQueues,
} from "../lib/adminQueues";
import { profilePatch } from "../lib/userCommands";
import { saveExistingUser } from "../lib/userSave";
import { AdminUserSummary, Catalog, Role } from "../types";
import { Pill } from "./Pill";

export type FlyoutTab = "account" | "queues" | "departments" | "password";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  normal: "Normal",
};

const QUEUE_MODE_OPTIONS: { mode: QueueAccessMode; label: string }[] = [
  { mode: "all", label: "Todas las colas" },
  { mode: "specific", label: "Colas específicas" },
  { mode: "none", label: "Sin acceso" },
];

const FIELD_CLASS =
  "h-9 rounded-[6px] bg-surface-2 px-3 text-sm text-text-strong focus:outline-none focus:ring-1 focus:ring-accent";
const INPUT_CLASS = `mt-1 w-full ${FIELD_CLASS}`;
const LABEL_CLASS = "block text-sm text-text-muted";
const ERROR_CLASS = "text-sm text-[color:var(--data-p0-text)]";
const BUTTON_PRIMARY =
  "rounded-full bg-accent-fill px-4 py-1.5 text-sm font-medium text-text-strong hover:opacity-90 disabled:opacity-50";
const BUTTON_SECONDARY =
  "rounded-full bg-surface-2 px-4 py-1.5 text-sm text-text hover:bg-surface-3 hover:text-text-strong";

interface UserFlyoutProps {
  /** null = usuario nuevo. */
  user: AdminUserSummary | null;
  initialTab: FlyoutTab;
  departments: string[];
  departmentsError: string | null;
  /** null = el catálogo de colas no se pudo cargar (Mesa de Servicio no disponible). */
  catalogQueues: Catalog["queues"] | null;
  onClose: () => void;
  /** Se llama tras guardar (recarga la lista). */
  onSaved: () => Promise<void> | void;
  /** Rol cambiado pero falló el resto: se refresca la lista y se informa. */
  onPartial: (message: string) => void;
  onUnauthorized: () => void;
}

/** Ninguno marcado = sin restricción (ve todos los departamentos) — mismo criterio que el backend. */
function DepartmentsCheckboxGroup({
  departments,
  selected,
  onChange,
}: {
  departments: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((d) => d !== name) : [...selected, name]);
  };

  if (departments.length === 0) {
    return <p className="mt-1 text-sm text-text-label">No hay departamentos disponibles.</p>;
  }

  return (
    <div className="mt-1 max-h-64 space-y-1.5 thin-scroll overflow-y-auto rounded-[6px] bg-surface-2 p-2.5">
      {departments.map((name) => (
        <label key={name} className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} className="h-3.5 w-3.5" />
          {name}
        </label>
      ))}
    </div>
  );
}

export function UserFlyout({
  user,
  initialTab,
  departments,
  departmentsError,
  catalogQueues,
  onClose,
  onSaved,
  onPartial,
  onUnauthorized,
}: UserFlyoutProps) {
  const isNew = user === null;
  const [tab, setTab] = useState<FlyoutTab>(isNew && initialTab === "password" ? "account" : initialTab);
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "normal");
  const [initialPassword, setInitialPassword] = useState("");
  // Un usuario nuevo arranca sin acceso a la Mesa de Servicio hasta que se le asignen colas.
  const [queueMode, setQueueMode] = useState<QueueAccessMode>(modeFromAllowedQueues(user?.allowedQueues ?? null));
  const [queues, setQueues] = useState<string[]>(user?.allowedQueues ?? []);
  const [allowedDepartments, setAllowedDepartments] = useState<string[]>(user?.allowedDepartments ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);

  const { known, unknown } = splitSelectedQueues(queues, catalogQueues);

  const tabs: { id: FlyoutTab; label: string }[] = [
    { id: "account", label: "Cuenta" },
    { id: "queues", label: "Colas" },
    { id: "departments", label: "Departamentos" },
    ...(isNew ? [] : [{ id: "password" as const, label: "Contraseña" }]),
  ];

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (username.trim() === "" || email.trim() === "") {
      setTab("account");
      setError("Completá el usuario y el email.");
      return;
    }
    if (isNew && initialPassword.length < 8) {
      setTab("account");
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    const queuesPayload = buildQueuesPayload(queueMode, queues);
    if (!queuesPayload.ok) {
      setTab("queues");
      setError(queuesPayload.error);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (user === null) {
        await createUser({
          username,
          email,
          password: initialPassword,
          role,
          // Si osTicket no respondió, no se envía: el backend no debe revalidar contra una base caída.
          ...(departmentsError ? {} : { allowedDepartments }),
          allowedQueues: queuesPayload.value,
        });
      } else {
        // Solo viaja lo que cambió: con la Mesa de Servicio u osTicket caídos igual se puede editar el resto.
        const patch = profilePatch(user, {
          username,
          email,
          allowedQueues: queuesPayload.value,
          allowedDepartments,
        });
        const result = await saveExistingUser(
          { setUserRole, updateUserProfile },
          user.username,
          role !== user.role ? role : null,
          patch
        );
        if (result.status === "partial") {
          if (result.error instanceof UnauthorizedError) {
            onUnauthorized();
            return;
          }
          await onSaved();
          onPartial(result.message);
          onClose();
          return;
        }
      }
      await onSaved();
      onClose();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setError(
        err instanceof Error ? err.message : isNew ? "No se pudo crear el usuario." : "No se pudo guardar los cambios."
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (newPassword.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordDone(false);
    try {
      await setUserPassword(user.username, newPassword);
      setNewPassword("");
      setPasswordDone(true);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setPasswordError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <SidePanel open onClose={onClose} width={380} label={user ? `Usuario ${user.username}` : "Nuevo usuario"}>
      <div className="flex h-full flex-col">
        <div className="px-5 pb-3">
          <h2 className="text-lg font-medium text-text-strong">{user ? user.username : "Nuevo usuario"}</h2>
          {user && <p className="text-sm text-text-muted">{user.email}</p>}
        </div>

        <div role="tablist" className="flex gap-1 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-2.5 py-2 text-sm ${
                tab === t.id
                  ? "border-accent text-text-strong"
                  : "border-transparent text-text-muted hover:text-text-strong"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "password" && user ? (
          <form onSubmit={handlePassword} className="min-h-0 flex-1 space-y-4 thin-scroll overflow-y-auto px-5 py-4">
            <label className={LABEL_CLASS}>
              Contraseña nueva
              <PasswordInput
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordDone(false);
                }}
                required
                autoFocus
                minLength={8}
                className={FIELD_CLASS}
              />
            </label>
            {passwordError && <p className={ERROR_CLASS}>{passwordError}</p>}
            {passwordDone && <p className="text-sm text-[color:var(--data-p3-text)]">Contraseña actualizada.</p>}
            <button type="submit" disabled={passwordSaving} className={BUTTON_PRIMARY}>
              {passwordSaving ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 thin-scroll overflow-y-auto px-5 py-4">
              {tab === "account" && (
                <>
                  <label className={LABEL_CLASS}>
                    Usuario
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoFocus
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className={LABEL_CLASS}>
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={INPUT_CLASS}
                    />
                  </label>
                  {isNew && (
                    <label className={LABEL_CLASS}>
                      Contraseña inicial
                      <PasswordInput
                        value={initialPassword}
                        onChange={(e) => setInitialPassword(e.target.value)}
                        required
                        minLength={8}
                        className={FIELD_CLASS}
                      />
                    </label>
                  )}
                  {isNew && departmentsError && (
                    <p role="note" className="text-xs text-[color:var(--data-p1-text)]">
                      Sin la lista de departamentos el usuario se crea sin restricción: verá todo el histórico de
                      osTicket. Podés restringirlo editándolo cuando la lista vuelva a cargar.
                    </p>
                  )}
                  <label className={LABEL_CLASS}>
                    Rol
                    <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={INPUT_CLASS}>
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {tab === "queues" && (
                <div className={LABEL_CLASS}>
                  Colas de la Mesa de Servicio
                  <div className="mt-1 space-y-1.5">
                    {QUEUE_MODE_OPTIONS.map((option) => (
                      <label key={option.mode} className="flex items-center gap-2 text-sm text-text">
                        <input
                          type="radio"
                          name="queue-access-mode"
                          checked={queueMode === option.mode}
                          onChange={() => setQueueMode(option.mode)}
                          className="h-3.5 w-3.5"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  {queueMode === "specific" && unknown.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {unknown.map((name) => (
                        <Pill key={name} tone="error">
                          Cola inexistente: {name}
                          <button
                            type="button"
                            onClick={() => setQueues(queues.filter((q) => q !== name))}
                            aria-label={`Quitar ${name}`}
                            title="Quitar"
                            className="ml-1 hover:text-text-strong"
                          >
                            ✕
                          </button>
                        </Pill>
                      ))}
                    </div>
                  )}
                  {queueMode === "specific" &&
                    (catalogQueues ? (
                      <QueueTreeSelect
                        multiple
                        queues={catalogQueues}
                        value={known}
                        onChange={(next) => setQueues(mergeKnownSelection(unknown, next))}
                        placeholder="Elegí las colas"
                        className="mt-2"
                      />
                    ) : (
                      <p className="mt-2 text-sm text-text-label">
                        No se pudo cargar el catálogo de colas (Mesa de Servicio no disponible).
                      </p>
                    ))}
                  {queueMode === "none" && (
                    <p className="mt-2 text-xs text-text-label">
                      El usuario no verá tickets de la Mesa de Servicio hasta que se le asignen colas.
                    </p>
                  )}
                </div>
              )}

              {tab === "departments" && (
                <div className={LABEL_CLASS}>
                  Departamentos (histórico osTicket)
                  {departmentsError && (
                    <span className="mt-1 block text-xs text-[color:var(--data-p0-text)]">{departmentsError}</span>
                  )}
                  {departmentsError && isNew && (
                    <span role="note" className="mt-1 block text-xs text-[color:var(--data-p1-text)]">
                      Sin la lista de departamentos el usuario se crea sin restricción: verá todo el histórico de
                      osTicket. Podés restringirlo editándolo cuando la lista vuelva a cargar.
                    </span>
                  )}
                  {departmentsError ? (
                    !isNew && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {allowedDepartments.length === 0 ? (
                          <Pill>Todos</Pill>
                        ) : (
                          allowedDepartments.map((name) => <Pill key={name}>{name}</Pill>)
                        )}
                      </div>
                    )
                  ) : (
                    <DepartmentsCheckboxGroup
                      departments={departments}
                      selected={allowedDepartments}
                      onChange={setAllowedDepartments}
                    />
                  )}
                </div>
              )}

              {error && <p className={ERROR_CLASS}>{error}</p>}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3">
              <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>
                {saving ? (isNew ? "Creando..." : "Guardando...") : isNew ? "Crear" : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </SidePanel>
  );
}
