import { NextFunction, Response, Router } from "express";
import { readOnlyQuery } from "../legacy/osticket/db";
import { requireRole } from "../auth";
import { normalizeName } from "../lib/normalizeName";
import { respondZnunyError } from "../lib/znunyErrors";
import { getCatalog, getSiteOptions } from "../znuny/catalogRepository";
import { ZnunyUnavailableError } from "../znuny/db";
import { sitesRepository } from "../repositories/sitesRepository";
import { usersRepository } from "../repositories/usersRepository";
import { Role, SiteType } from "../types";

export const adminRouter = Router();

// Todo lo registrado en este router exige sesión con rol admin — el login
// para cualquier usuario (admin o normal) vive en routes/auth.ts.
adminRouter.use(requireRole("admin"));

const VALID_SITE_TYPES: SiteType[] = ["aduana_terrestre", "aduana_maritima", "aduana_aerea", "sede"];
const VALID_ROLES: Role[] = ["admin", "normal"];

const LEGACY_UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
  "ENOTFOUND",
  "PROTOCOL_CONNECTION_LOST",
  "ER_ACCESS_DENIED_ERROR",
]);

/** osTicket inalcanzable (túnel caído, DB apagada) -> 503 claro en vez de 500. */
function respondLegacyDbError(error: unknown, res: Response, next: NextFunction): void {
  const code = (error as { code?: string } | null)?.code;
  if (code && LEGACY_UNAVAILABLE_CODES.has(code)) {
    res.status(503).json({ error: "osTicket no disponible" });
    return;
  }
  next(error);
}

/** Departamentos reales de osTicket — misma regla de oro que sitios: nunca hardcodear, siempre en vivo contra ost_department. */
async function loadRealDepartmentNames(): Promise<string[]> {
  const rows = await readOnlyQuery<{ name: string }>(`SELECT name FROM ost_department ORDER BY name`);
  return rows.map((row) => row.name);
}

type ResolveAllowedDepartmentsResult =
  | { ok: true; departments: string[] }
  | { ok: false; error: string };

/**
 * Valida allowedDepartments contra la lista en vivo (nunca se confía en que
 * el frontend ya filtró nombres válidos) y devuelve el nombre CANÓNICO tal
 * como viene de ost_department, no el string crudo recibido — evita drift
 * de mayúsculas/espacios entre lo guardado y lo que después compara el
 * poller/consulta SQL.
 */
function resolveAllowedDepartments(raw: unknown, realNames: string[]): ResolveAllowedDepartmentsResult {
  if (raw === undefined) return { ok: true, departments: [] };
  if (!Array.isArray(raw) || !raw.every((v) => typeof v === "string")) {
    return { ok: false, error: "allowedDepartments debe ser un array de strings." };
  }

  const departments: string[] = [];
  for (const name of raw) {
    const canonical = realNames.find((real) => normalizeName(real) === normalizeName(name));
    if (!canonical) {
      return {
        ok: false,
        error: `"${name}" no existe como departamento real en osTicket (ost_department).`,
      };
    }
    if (!departments.includes(canonical)) departments.push(canonical);
  }
  return { ok: true, departments };
}

/** Opciones de Ubicacion de Znuny que todavía no tienen un sitio configurado (tipo + lat/lng). */
adminRouter.get("/sites/unmapped", async (_req, res, next) => {
  try {
    const configured = new Set(
      sitesRepository.findAll().map((site) => site.znunyKey).filter((k): k is string => !!k)
    );
    const options = await getSiteOptions();
    res.json(options.filter((option) => !configured.has(option.key)));
  } catch (error) {
    respondZnunyError(error, res, next);
  }
});

adminRouter.get("/sites", (_req, res) => {
  res.json(sitesRepository.findAll());
});

adminRouter.get("/queues", async (_req, res, next) => {
  try {
    res.json((await getCatalog()).queues);
  } catch (error) {
    respondZnunyError(error, res, next);
  }
});

/**
 * Asigna tipo y coordenadas a una opción de Ubicacion que YA existe en Znuny —
 * nunca "inventa" un sitio: la clave se valida en vivo contra getSiteOptions()
 * (también si la petición viene de curl directo).
 */
adminRouter.post("/sites", async (req, res, next) => {
  try {
    const { znunyKey, type, lat, lng } = (req.body ?? {}) as {
      znunyKey?: unknown;
      type?: unknown;
      lat?: unknown;
      lng?: unknown;
    };

    if (typeof znunyKey !== "string" || znunyKey.trim().length === 0) {
      res.status(400).json({ error: "znunyKey es requerido." });
      return;
    }
    if (typeof type !== "string" || !VALID_SITE_TYPES.includes(type as SiteType)) {
      res.status(400).json({ error: `type debe ser uno de: ${VALID_SITE_TYPES.join(", ")}` });
      return;
    }
    if (
      typeof lat !== "number" ||
      !Number.isFinite(lat) ||
      typeof lng !== "number" ||
      !Number.isFinite(lng)
    ) {
      res.status(400).json({ error: "lat y lng deben ser números." });
      return;
    }

    const options = await getSiteOptions();
    if (!options.some((option) => option.key === znunyKey)) {
      res.status(400).json({
        error: `"${znunyKey}" no existe como opción del campo Ubicacion en Znuny. No se puede asignar coordenadas a un sitio inventado.`,
      });
      return;
    }

    const saved = sitesRepository.upsertByZnunyKey({
      znunyKey,
      type: type as SiteType,
      lat,
      lng,
    });
    res.status(200).json(saved);
  } catch (error) {
    respondZnunyError(error, res, next);
  }
});

adminRouter.delete("/sites/:name", (req, res) => {
  const removed = sitesRepository.remove(decodeURIComponent(req.params.name));
  if (!removed) {
    res.status(404).json({ error: "Sitio no encontrado en site-metadata.json." });
    return;
  }
  res.json({ ok: true });
});

/** Fuente en vivo para poblar el selector de departamentos del panel (creación/edición de usuarios). */
adminRouter.get("/departments", async (_req, res, next) => {
  try {
    res.json(await loadRealDepartmentNames());
  } catch (error) {
    respondLegacyDbError(error, res, next);
  }
});

// --- Gestión de usuarios (admin-only) ---------------------------------

// Una cola renombrada en Znuny deja un nombre viejo en allowedQueues: se marca
// en unknownQueues (el usuario pierde acceso a esa cola sin error). Si Znuny
// está caído no se puede saber, se devuelve [] sin fallar.
adminRouter.get("/users", async (_req, res, next) => {
  try {
    let known: Set<string> | null = null;
    try {
      known = new Set((await getCatalog()).queues.map((q) => q.name));
    } catch (error) {
      if (!(error instanceof ZnunyUnavailableError)) throw error;
    }
    res.json(
      usersRepository.findAll().map((user) => ({
        ...user,
        unknownQueues: known ? (user.allowedQueues ?? []).filter((q) => !known!.has(q)) : [],
      }))
    );
  } catch (error) {
    next(error);
  }
});

type ResolveQueuesResult =
  | { ok: true; queues: string[] | null | undefined }
  | { ok: false; error: string };

/** Valida allowedQueues contra las colas existentes en Znuny (400 listando las desconocidas). */
async function resolveAllowedQueues(raw: unknown): Promise<ResolveQueuesResult> {
  if (raw === undefined) return { ok: true, queues: undefined };
  if (raw === null) return { ok: true, queues: null };
  if (!Array.isArray(raw) || !raw.every((v) => typeof v === "string")) {
    return { ok: false, error: "allowedQueues debe ser un array de strings o null." };
  }
  const known = new Set((await getCatalog()).queues.map((q) => q.name));
  const unknown = raw.filter((q) => !known.has(q));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Colas inexistentes en Znuny: ${unknown.map((q) => `"${q}"`).join(", ")}.`,
    };
  }
  return { ok: true, queues: [...new Set(raw)] };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

adminRouter.post("/users", async (req, res, next) => {
  try {
    const { username, email, password, role, allowedDepartments, allowedQueues } = (req.body ?? {}) as {
      username?: unknown;
      email?: unknown;
      password?: unknown;
      role?: unknown;
      allowedDepartments?: unknown;
      allowedQueues?: unknown;
    };

    if (typeof username !== "string" || username.trim().length === 0) {
      res.status(400).json({ error: "username es requerido." });
      return;
    }
    if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
      res.status(400).json({ error: "email es requerido y debe ser válido." });
      return;
    }
    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "password debe tener al menos 8 caracteres." });
      return;
    }
    if (typeof role !== "string" || !VALID_ROLES.includes(role as Role)) {
      res.status(400).json({ error: `role debe ser uno de: ${VALID_ROLES.join(", ")}` });
      return;
    }

    const realDepartments = await loadRealDepartmentNames();
    const resolvedDepartments = resolveAllowedDepartments(allowedDepartments, realDepartments);
    if (!resolvedDepartments.ok) {
      res.status(400).json({ error: resolvedDepartments.error });
      return;
    }

    const resolvedQueues = await resolveAllowedQueues(allowedQueues);
    if (!resolvedQueues.ok) {
      res.status(400).json({ error: resolvedQueues.error });
      return;
    }

    const result = await usersRepository.create({
      username: username.trim(),
      email: email.trim(),
      password,
      role: role as Role,
      allowedDepartments: resolvedDepartments.departments,
      // null en la creación equivale a "sin acceso" (campo ausente).
      ...(resolvedQueues.queues ? { allowedQueues: resolvedQueues.queues } : {}),
    });
    if (!result.ok) {
      const message =
        result.error === "duplicate-email"
          ? `Ya existe otra cuenta con el email "${email}". Un mismo email no puede pertenecer a dos cuentas: "¿Olvidaste tu contraseña?" resetearía la que no esperás.`
          : `"${username}" ya existe.`;
      res.status(409).json({ error: message });
      return;
    }
    res.status(201).json(result.user);
  } catch (error) {
    respondZnunyError(error, res, next);
  }
});

adminRouter.patch("/users/:username/role", (req, res) => {
  const { role } = (req.body ?? {}) as { role?: unknown };
  if (typeof role !== "string" || !VALID_ROLES.includes(role as Role)) {
    res.status(400).json({ error: `role debe ser uno de: ${VALID_ROLES.join(", ")}` });
    return;
  }

  const username = decodeURIComponent(req.params.username);
  // Si esto degrada al último admin restante, la sesión que lo hizo se
  // queda sin nadie que pueda revertirlo — mismo espíritu que el guard de
  // "no borrar al último admin" de abajo.
  if (role !== "admin") {
    const target = usersRepository.findByUsername(username);
    if (target?.role === "admin" && usersRepository.countAdmins() <= 1) {
      res.status(400).json({ error: "No se puede quitar el rol admin al único admin restante." });
      return;
    }
  }

  const updated = usersRepository.setRole(username, role as Role);
  if (!updated) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  res.json(updated);
});

adminRouter.patch("/users/:username/profile", async (req, res, next) => {
  try {
    const { username: newUsername, email, allowedDepartments, allowedQueues } = (req.body ?? {}) as {
      username?: unknown;
      email?: unknown;
      allowedDepartments?: unknown;
      allowedQueues?: unknown;
    };

    const updates: {
      username?: string;
      email?: string;
      allowedDepartments?: string[];
      allowedQueues?: string[] | null;
    } = {};
    if (newUsername !== undefined) {
      if (typeof newUsername !== "string" || newUsername.trim().length === 0) {
        res.status(400).json({ error: "username no puede quedar vacío." });
        return;
      }
      updates.username = newUsername.trim();
    }
    if (email !== undefined) {
      if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
        res.status(400).json({ error: "email debe ser válido." });
        return;
      }
      updates.email = email.trim();
    }
    if (allowedDepartments !== undefined) {
      const realDepartments = await loadRealDepartmentNames();
      const resolvedDepartments = resolveAllowedDepartments(allowedDepartments, realDepartments);
      if (!resolvedDepartments.ok) {
        res.status(400).json({ error: resolvedDepartments.error });
        return;
      }
      updates.allowedDepartments = resolvedDepartments.departments;
    }
    const resolvedQueues = await resolveAllowedQueues(allowedQueues);
    if (!resolvedQueues.ok) {
      res.status(400).json({ error: resolvedQueues.error });
      return;
    }
    if (resolvedQueues.queues !== undefined) updates.allowedQueues = resolvedQueues.queues;

    const currentUsername = decodeURIComponent(req.params.username);
    const result = usersRepository.updateProfile(currentUsername, updates);
    if (!result.ok) {
      if (result.error === "not-found") {
        res.status(404).json({ error: "Usuario no encontrado." });
        return;
      }
      const message =
        result.error === "duplicate-email"
          ? `Ya existe otra cuenta con el email "${email}".`
          : `El usuario "${newUsername}" ya existe.`;
      res.status(409).json({ error: message });
      return;
    }
    res.json(result.user);
  } catch (error) {
    respondZnunyError(error, res, next);
  }
});

adminRouter.patch("/users/:username/password", async (req, res, next) => {
  try {
    const { password } = (req.body ?? {}) as { password?: unknown };
    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "password debe tener al menos 8 caracteres." });
      return;
    }

    const username = decodeURIComponent(req.params.username);
    const updated = await usersRepository.setPassword(username, password);
    if (!updated) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/users/:username", (req, res) => {
  const username = decodeURIComponent(req.params.username);

  if (username.trim().toLowerCase() === req.user!.username.trim().toLowerCase()) {
    res.status(400).json({ error: "No podés borrar tu propia cuenta mientras estás logueado con ella." });
    return;
  }

  const target = usersRepository.findByUsername(username);
  if (target?.role === "admin" && usersRepository.countAdmins() <= 1) {
    res.status(400).json({ error: "No se puede borrar al único admin restante." });
    return;
  }

  const removed = usersRepository.remove(username);
  if (!removed) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  res.json({ ok: true });
});
