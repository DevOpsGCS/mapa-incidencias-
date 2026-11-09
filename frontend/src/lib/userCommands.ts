import type { UpdateUserProfilePayload } from "../api/adminClient";
import { AdminUserSummary } from "../types";
import { queuesChanged } from "./adminQueues";

export const DELETE_SELF_REASON = "No podés eliminar tu propio usuario";
export const DELETE_LAST_ADMIN_REASON = "Tiene que quedar al menos un administrador";

export interface CommandState {
  resetPassword: boolean;
  delete: { enabled: boolean; reason: string | null };
}

/** Qué comandos de la barra están disponibles según la selección de la lista. */
export function commandState(
  selected: string[],
  users: AdminUserSummary[],
  currentUsername: string
): CommandState {
  const resetPassword = selected.length === 1;
  if (selected.length === 0) return { resetPassword, delete: { enabled: false, reason: null } };

  const me = currentUsername.toLowerCase();
  if (selected.some((name) => name.toLowerCase() === me)) {
    return { resetPassword, delete: { enabled: false, reason: DELETE_SELF_REASON } };
  }

  const picked = new Set(selected);
  const adminsLeft = users.filter((u) => u.role === "admin" && !picked.has(u.username)).length;
  const deletesAnAdmin = users.some((u) => u.role === "admin" && picked.has(u.username));
  if (deletesAnAdmin && adminsLeft === 0) {
    return { resetPassword, delete: { enabled: false, reason: DELETE_LAST_ADMIN_REASON } };
  }
  return { resetPassword, delete: { enabled: true, reason: null } };
}

function sameSet(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

export interface ProfileDraft {
  username: string;
  email: string;
  allowedQueues: string[] | null;
  allowedDepartments: string[];
}

/** Payload del PATCH de perfil con solo los campos que cambiaron (departamentos se compara como conjunto). */
export function profilePatch(original: AdminUserSummary, draft: ProfileDraft): UpdateUserProfilePayload {
  const patch: UpdateUserProfilePayload = {};
  if (draft.username !== original.username) patch.username = draft.username;
  if (draft.email !== original.email) patch.email = draft.email;
  if (!sameSet(draft.allowedDepartments, original.allowedDepartments)) {
    patch.allowedDepartments = draft.allowedDepartments;
  }
  if (queuesChanged(original.allowedQueues, draft.allowedQueues)) patch.allowedQueues = draft.allowedQueues;
  return patch;
}
