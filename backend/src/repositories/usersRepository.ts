import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { PublicUser, Role } from "../types";
import { DATA_DIR, SEED_DIR } from "../lib/dataDir";
import { accessFromAllowedQueues, QueueAccess } from "../znuny/queueAccess";
import { migrateUsersV2, StoredUser, UsersFileV2 } from "../migrations/usersV2";

/**
 * Capa de acceso a datos de usuarios/roles. Mismo patrón que
 * sitesRepository.ts: users.seed.json (trackeado) es el punto de partida;
 * users.json (gitignored) es el estado real, editado desde el panel
 * /admin/sites (sección "Usuarios"). No hay base de datos propia para esto
 * — la de MySQL es de solo lectura y de osTicket, no nuestra.
 */
const USERS_PATH = path.join(DATA_DIR, "users.json");
const SEED_PATH = path.join(SEED_DIR, "users.seed.json");
const PASSWORD_HASH_COST = 12; // mismo costo que scripts/hashPassword.ts

type UsersFile = UsersFileV2;

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function readUsersFile(filePath: string): UsersFile {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as UsersFile;
  // Compatibilidad con usuarios creados antes de estos campos (email,
  // resetToken/resetTokenExpiry) — nunca deben quedar undefined en memoria.
  for (const user of parsed.users) {
    if (user.email === undefined) user.email = "";
    if (user.resetToken === undefined) user.resetToken = null;
    if (user.resetTokenExpiry === undefined) user.resetTokenExpiry = null;
    if (user.allowedDepartments === undefined) user.allowedDepartments = [];
  }
  return parsed;
}

function ensureUsersFileExists(): void {
  if (fs.existsSync(USERS_PATH)) return;
  console.log(
    `[usersRepository] users.json no existe todavía, lo creo a partir del seed (${SEED_PATH}).`
  );
  fs.copyFileSync(SEED_PATH, USERS_PATH);
}

// schemaVersion: 2 se persiste SIEMPRE: sin él la migración correría en cada
// arranque y convertiría a un usuario nuevo "sin configurar" en [] (todas las colas).
function writeUsersFile(users: StoredUser[]): void {
  fs.writeFileSync(
    USERS_PATH,
    JSON.stringify({ schemaVersion: 2, users }, null, 2) + "\n",
    "utf-8"
  );
}

function backupSuffix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function toPublicUser(stored: StoredUser): PublicUser {
  return {
    username: stored.username,
    email: stored.email,
    role: stored.role,
    allowedDepartments: stored.allowedDepartments,
    allowedQueues: stored.allowedQueues ?? null,
  };
}

export type CreateUserResult =
  | { ok: true; user: PublicUser }
  | { ok: false; error: "duplicate-username" | "duplicate-email" };

export type ResetPasswordWithTokenResult = "ok" | "invalid" | "expired";

export type UpdateProfileResult =
  | { ok: true; user: PublicUser }
  | { ok: false; error: "not-found" | "duplicate-username" | "duplicate-email" };

export interface UsersRepository {
  findAll(): PublicUser[];
  findByUsername(username: string): StoredUser | undefined;
  findByEmail(email: string): StoredUser | undefined;
  create(input: {
    username: string;
    email: string;
    password: string;
    role: Role;
    allowedDepartments?: string[];
    allowedQueues?: string[];
  }): Promise<CreateUserResult>;
  setRole(username: string, role: Role): PublicUser | undefined;
  updateProfile(
    currentUsername: string,
    updates: {
      username?: string;
      email?: string;
      allowedDepartments?: string[];
      /** null borra el campo (vuelve a "sin acceso"). */
      allowedQueues?: string[] | null;
    }
  ): UpdateProfileResult;
  setResetToken(username: string, token: string, expiresAt: number): void;
  resetPasswordWithToken(token: string, newPassword: string): Promise<ResetPasswordWithTokenResult>;
  /** Fijado directo por un admin (panel), sin pasar por el flujo de token de email. Devuelve false si el usuario no existe. */
  setPassword(username: string, newPassword: string): Promise<boolean>;
  remove(username: string): boolean;
  countAdmins(): number;
  /** null = sin restricción (ve todos los departamentos). Siempre lee el JSON en memoria más reciente, nunca un valor cacheado en el JWT — así un cambio de permisos por el admin aplica de inmediato, sin esperar a que expire la sesión. */
  getAllowedDepartments(username: string): string[] | null;
  /** Acceso a colas de Znuny; siempre lee el estado en memoria más reciente. */
  getQueueAccess(username: string): QueueAccess;
}

class JsonUsersRepository implements UsersRepository {
  private users: StoredUser[];

  constructor() {
    ensureUsersFileExists();
    const file = readUsersFile(USERS_PATH);
    const migrated = migrateUsersV2(file);
    if (migrated.changed) {
      const backup = `${USERS_PATH}.bak-${backupSuffix()}`;
      fs.copyFileSync(USERS_PATH, backup);
      console.log(`[usersRepository] migrando users.json a v2 (respaldo: ${backup}).`);
      this.users = migrated.file.users;
      writeUsersFile(this.users);
    } else {
      this.users = file.users;
    }
  }

  findAll(): PublicUser[] {
    return this.users.map(toPublicUser);
  }

  findByUsername(username: string): StoredUser | undefined {
    const target = normalizeUsername(username);
    return this.users.find((u) => normalizeUsername(u.username) === target);
  }

  findByEmail(email: string): StoredUser | undefined {
    const target = normalizeEmail(email);
    return this.users.find((u) => normalizeEmail(u.email) === target);
  }

  async create(input: {
    username: string;
    email: string;
    password: string;
    role: Role;
    allowedDepartments?: string[];
    allowedQueues?: string[];
  }): Promise<CreateUserResult> {
    const targetUsername = normalizeUsername(input.username);
    if (this.users.some((u) => normalizeUsername(u.username) === targetUsername)) {
      return { ok: false, error: "duplicate-username" };
    }
    // Un email nunca puede pertenecer a dos cuentas: findByEmail (usado por
    // forgot-password) devuelve la PRIMERA coincidencia, así que un email
    // compartido haría que restablecer la contraseña de una cuenta en
    // realidad resetee la otra sin que quien lo pide se entere.
    const targetEmail = normalizeEmail(input.email);
    if (this.users.some((u) => normalizeEmail(u.email) === targetEmail)) {
      return { ok: false, error: "duplicate-email" };
    }
    const passwordHash = await bcrypt.hash(input.password, PASSWORD_HASH_COST);
    const stored: StoredUser = {
      username: input.username.trim(),
      email: input.email.trim(),
      passwordHash,
      role: input.role,
      resetToken: null,
      resetTokenExpiry: null,
      allowedDepartments: input.allowedDepartments ?? [],
    };
    if (input.allowedQueues !== undefined) stored.allowedQueues = input.allowedQueues;
    this.users.push(stored);
    writeUsersFile(this.users);
    return { ok: true, user: toPublicUser(stored) };
  }

  setRole(username: string, role: Role): PublicUser | undefined {
    const user = this.findByUsername(username);
    if (!user) return undefined;
    user.role = role;
    writeUsersFile(this.users);
    return toPublicUser(user);
  }

  updateProfile(
    currentUsername: string,
    updates: {
      username?: string;
      email?: string;
      allowedDepartments?: string[];
      /** null borra el campo (vuelve a "sin acceso"). */
      allowedQueues?: string[] | null;
    }
  ): UpdateProfileResult {
    const user = this.findByUsername(currentUsername);
    if (!user) return { ok: false, error: "not-found" };

    if (updates.username !== undefined) {
      const target = normalizeUsername(updates.username);
      const collision = this.users.some((u) => u !== user && normalizeUsername(u.username) === target);
      if (collision) return { ok: false, error: "duplicate-username" };
    }
    if (updates.email !== undefined) {
      const target = normalizeEmail(updates.email);
      const collision = this.users.some((u) => u !== user && normalizeEmail(u.email) === target);
      if (collision) return { ok: false, error: "duplicate-email" };
    }

    if (updates.username !== undefined) user.username = updates.username.trim();
    if (updates.email !== undefined) user.email = updates.email.trim();
    if (updates.allowedDepartments !== undefined) user.allowedDepartments = updates.allowedDepartments;
    if (updates.allowedQueues === null) delete user.allowedQueues;
    else if (updates.allowedQueues !== undefined) user.allowedQueues = updates.allowedQueues;
    writeUsersFile(this.users);
    return { ok: true, user: toPublicUser(user) };
  }

  setResetToken(username: string, token: string, expiresAt: number): void {
    const user = this.findByUsername(username);
    if (!user) return;
    user.resetToken = token;
    user.resetTokenExpiry = expiresAt;
    writeUsersFile(this.users);
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<ResetPasswordWithTokenResult> {
    const user = this.users.find((u) => u.resetToken === token);
    if (!user) return "invalid";
    if (!user.resetTokenExpiry || user.resetTokenExpiry < Date.now()) return "expired";

    user.passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_COST);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    writeUsersFile(this.users);
    return "ok";
  }

  async setPassword(username: string, newPassword: string): Promise<boolean> {
    const user = this.findByUsername(username);
    if (!user) return false;
    user.passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_COST);
    // Un cambio de contraseña por el admin invalida cualquier token de
    // recuperación pendiente por email — evita que un link viejo conviva
    // con la contraseña nueva.
    user.resetToken = null;
    user.resetTokenExpiry = null;
    writeUsersFile(this.users);
    return true;
  }

  remove(username: string): boolean {
    const target = normalizeUsername(username);
    const index = this.users.findIndex((u) => normalizeUsername(u.username) === target);
    if (index < 0) return false;
    this.users.splice(index, 1);
    writeUsersFile(this.users);
    return true;
  }

  countAdmins(): number {
    return this.users.filter((u) => u.role === "admin").length;
  }

  getAllowedDepartments(username: string): string[] | null {
    const user = this.findByUsername(username);
    const allowed = user?.allowedDepartments ?? [];
    return allowed.length > 0 ? allowed : null;
  }

  getQueueAccess(username: string): QueueAccess {
    return accessFromAllowedQueues(this.findByUsername(username)?.allowedQueues);
  }
}

export const usersRepository: UsersRepository = new JsonUsersRepository();
