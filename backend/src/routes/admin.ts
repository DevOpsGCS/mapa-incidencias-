import { Router } from "express";
import { readOnlyQuery } from "../legacy/osticket/db";
import { requireRole } from "../auth";
import { normalizeName } from "../lib/normalizeName";
import { sitesRepository } from "../repositories/sitesRepository";
import { usersRepository } from "../repositories/usersRepository";
import { Role, SiteType } from "../types";

export const adminRouter = Router();

// Todo lo registrado en este router exige sesión con rol admin — el login
// para cualquier usuario (admin o normal) vive en routes/auth.ts.
adminRouter.use(requireRole("admin"));

// "Sitio de Aduana" (list_id=2) + "CCTV Sitios" (list_id=7): las mismas dos
// listas que usa ticketsRepository para resolver el sitio de cada ticket
// (ver comentario en SITE_LIST_IDS ahí). Un sitio "real" es cualquier valor
// vigente en cualquiera de las dos.
const SITE_LIST_IDS = [2, 7];
const VALID_SITE_TYPES: SiteType[] = ["aduana_terrestre", "aduana_maritima", "aduana_aerea", "sede"];
const VALID_ROLES: Role[] = ["admin", "normal"];

async function loadRealSiteNames(): Promise<string[]> {
  const rows = await readOnlyQuery<{ value: string }>(
    `SELECT DISTINCT value FROM ost_list_items WHERE list_id IN (${SITE_LIST_IDS.join(",")}) ORDER BY id`
  );
  return rows.map((row) => row.value);
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

/** Sitios reales de osTicket que todavía no tienen una entrada en site-metadata.json. */
adminRouter.get("/sites/unmapped", async (_req, res, next) => {
  try {
    const realNames = await loadRealSiteNames();
    const configuredNormalized = new Set(
      sitesRepository.findAll().map((site) => normalizeName(site.name))
    );

    const seen = new Set<string>();
    const unmapped: string[] = [];
    for (const name of realNames) {
      const key = normalizeName(name);
      if (configuredNormalized.has(key) || seen.has(key)) continue;
      seen.add(key);
      unmapped.push(name);
    }

    res.json(unmapped);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/sites", (_req, res) => {
  res.json(sitesRepository.findAll());
});

/**
 * Asigna coordenadas (lat/lng) y tipo a un sitio que YA existe en osTicket —
 * este endpoint nunca "crea" un sitio en el sentido de inventarlo. El name
 * recibido se valida en vivo contra ost_list_items antes de guardar nada:
 * si no coincide (comparación normalizada) con ningún valor real, se
 * rechaza con 400. Esto vale tanto si la petición viene del panel como si
 * viene de Postman/curl directo — la validación es del backend, nunca se
 * confía en que el frontend ya filtró los nombres válidos.
 */
adminRouter.post("/sites", async (req, res, next) => {
  try {
    const { name, type, lat, lng } = (req.body ?? {}) as {
      name?: unknown;
      type?: unknown;
      lat?: unknown;
      lng?: unknown;
    };

    if (typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "name es requerido." });
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

    const realNames = await loadRealSiteNames();
    const target = normalizeName(name);
    const isRealSite = realNames.some((real) => normalizeName(real) === target);
    if (!isRealSite) {
      res.status(400).json({
        error: `"${name}" no existe como sitio real en osTicket (ost_list_items, list_id IN (${SITE_LIST_IDS.join(
          ","
        )})). No se puede asignar coordenadas a un sitio inventado.`,
      });
      return;
    }

    const saved = sitesRepository.upsert({ name: name.trim(), type: type as SiteType, lat, lng });
    res.status(200).json(saved);
  } catch (error) {
    next(error);
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
    next(error);
  }
});

// --- Gestión de usuarios (admin-only) ---------------------------------

adminRouter.get("/users", (_req, res) => {
  res.json(usersRepository.findAll());
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

adminRouter.post("/users", async (req, res, next) => {
  try {
    const { username, email, password, role, allowedDepartments } = (req.body ?? {}) as {
      username?: unknown;
      email?: unknown;
      password?: unknown;
      role?: unknown;
      allowedDepartments?: unknown;
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

    const result = await usersRepository.create({
      username: username.trim(),
      email: email.trim(),
      password,
      role: role as Role,
      allowedDepartments: resolvedDepartments.departments,
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
    next(error);
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
    const { username: newUsername, email, allowedDepartments } = (req.body ?? {}) as {
      username?: unknown;
      email?: unknown;
      allowedDepartments?: unknown;
    };

    const updates: { username?: string; email?: string; allowedDepartments?: string[] } = {};
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
    next(error);
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
