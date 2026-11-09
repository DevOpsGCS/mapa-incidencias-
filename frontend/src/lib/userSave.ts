import type { UpdateUserProfilePayload } from "../api/adminClient";
import { Role } from "../types";

export interface UserSaveApi {
  setUserRole: (username: string, role: Role) => Promise<unknown>;
  updateUserProfile: (username: string, patch: UpdateUserProfilePayload) => Promise<unknown>;
}

export type UserSaveResult =
  | { status: "ok" }
  /** El rol ya se cambió en el servidor pero el PATCH de perfil falló: hay que refrescar la lista. */
  | { status: "partial"; error: unknown; message: string };

export function partialMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : "error desconocido";
  return `Rol actualizado; no se pudieron guardar los demás cambios: ${detail}`;
}

/** Guarda un usuario existente: primero el rol (si cambió) y luego el perfil (si hay campos cambiados). */
export async function saveExistingUser(
  api: UserSaveApi,
  username: string,
  roleChange: Role | null,
  patch: UpdateUserProfilePayload
): Promise<UserSaveResult> {
  if (roleChange) await api.setUserRole(username, roleChange);
  if (Object.keys(patch).length > 0) {
    try {
      await api.updateUserProfile(username, patch);
    } catch (error) {
      if (roleChange) return { status: "partial", error, message: partialMessage(error) };
      throw error;
    }
  }
  return { status: "ok" };
}
