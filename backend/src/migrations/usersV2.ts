/**
 * Migración v2 de users.json (función pura): agrega permisos por cola de Znuny.
 * Un usuario que hoy no tiene restricción de departamento (allowedDepartments
 * vacío) conserva su acceso total -> allowedQueues: []. Un usuario restringido
 * queda SIN la clave (= sin acceso a Znuny hasta que un admin le asigne colas).
 * El schemaVersion evita re-ejecutarla: un usuario nuevo sin allowedQueues
 * debe seguir sin acceso, no convertirse en [] ("todas las colas").
 */
export interface StoredUser {
  username: string;
  email: string;
  passwordHash: string;
  role: "admin" | "normal";
  resetToken: string | null;
  resetTokenExpiry: number | null;
  allowedDepartments: string[];
  /** Ausente = sin acceso a Znuny; [] = todas las colas; lista = esas colas y subcolas. */
  allowedQueues?: string[];
}

export interface UsersFileV2 {
  schemaVersion?: number;
  users: StoredUser[];
}

export function migrateUsersV2(file: UsersFileV2): { changed: boolean; file: UsersFileV2 } {
  if ((file.schemaVersion ?? 1) >= 2) return { changed: false, file };
  const users = file.users.map((user) => {
    if (user.allowedQueues !== undefined) return user;
    const departments = user.allowedDepartments ?? [];
    return departments.length === 0 ? { ...user, allowedQueues: [] } : user;
  });
  return { changed: true, file: { ...file, schemaVersion: 2, users } };
}
