import { parse } from "yaml";
import { znunyReadOnlyQuery } from "./db";
import type { Catalog, StateType } from "./types";

export const CATALOG_TTL_MS = 60000;

/** Traduce el tipo de estado de Znuny; null = excluir (merged/removed). */
export function normalizeStateType(typeName: string): StateType | null {
  const t = typeName.trim().toLowerCase();
  if (t === "merged" || t === "removed") return null;
  if (t.startsWith("pending")) return "pending";
  if (t === "new" || t === "open" || t === "closed") return t;
  console.warn(`[catálogo] tipo de estado desconocido "${typeName}", se trata como "open"`);
  return "open";
}

/** rank 0 = id más alto (en Znuny el id define el orden de prioridad). */
/**
 * Color de estado configurado en Znuny ("#RRGGBBAA" o "#RRGGBB") → "#rrggbb".
 * Se descarta el canal alfa; cualquier otro formato → null (el frontend usa su color por tipo).
 */
export function normalizeStateColor(raw: string | null | undefined): string | null {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec((raw ?? "").trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

export function rankPriorities(
  rows: { id: number; name: string }[]
): { id: number; name: string; rank: number }[] {
  const sorted = [...rows].sort((a, b) => b.id - a.id);
  return sorted.map((r, i) => ({ id: r.id, name: r.name, rank: i }));
}

/** Lee `PossibleValues` (clave → etiqueta) del YAML de dynamic_field.config. */
export function parseDropdownOptions(configYaml: string): { key: string; label: string }[] {
  const doc = parse(configYaml) as { PossibleValues?: Record<string, unknown> } | null;
  const values = doc?.PossibleValues;
  if (!values || typeof values !== "object") return [];
  return Object.entries(values).map(([key, label]) => ({ key, label: String(label) }));
}

let cache: { at: number; value: Catalog } | null = null;

export async function getCatalog(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < CATALOG_TTL_MS) return cache.value;

  const [queueRows, stateRows, priorityRows, typeRows, serviceRows] = await Promise.all([
    znunyReadOnlyQuery<{ id: number; name: string; valid_id: number }>(
      "SELECT id, name, valid_id FROM queue ORDER BY name"
    ),
    znunyReadOnlyQuery<{ id: number; name: string; type_name: string; color: string | null }>(
      `SELECT s.id, s.name, s.color, t.name AS type_name
         FROM ticket_state s JOIN ticket_state_type t ON t.id = s.type_id
        WHERE s.valid_id = 1 ORDER BY s.id`
    ),
    znunyReadOnlyQuery<{ id: number; name: string }>(
      "SELECT id, name FROM ticket_priority WHERE valid_id = 1"
    ),
    znunyReadOnlyQuery<{ name: string }>("SELECT name FROM ticket_type WHERE valid_id = 1 ORDER BY name"),
    znunyReadOnlyQuery<{ name: string }>("SELECT name FROM service WHERE valid_id = 1 ORDER BY name"),
  ]);

  const queues = queueRows.map((q) => {
    const idx = q.name.lastIndexOf("::");
    return {
      id: q.id,
      name: q.name,
      parent: idx >= 0 ? q.name.slice(0, idx) : null,
      valid: q.valid_id === 1,
    };
  });

  const states: Catalog["states"] = [];
  for (const s of stateRows) {
    const type = normalizeStateType(s.type_name);
    if (type) states.push({ id: s.id, name: s.name, type, color: normalizeStateColor(s.color) });
  }

  const priorities = rankPriorities(priorityRows);
  const topPriorityId = priorities.length ? Math.max(...priorities.map((p) => p.id)) : 0;

  const value: Catalog = {
    queues,
    states,
    priorities,
    types: typeRows.map((r) => r.name),
    services: serviceRows.map((r) => r.name),
    topPriorityId,
  };
  cache = { at: Date.now(), value };
  return value;
}

let siteCache: { at: number; value: { key: string; label: string }[] } | null = null;

/** Opciones del campo dinámico `Ubicacion` (siempre por nombre, nunca por id). */
export async function getSiteOptions(): Promise<{ key: string; label: string }[]> {
  if (siteCache && Date.now() - siteCache.at < CATALOG_TTL_MS) return siteCache.value;
  const rows = await znunyReadOnlyQuery<{ config: string }>(
    "SELECT config FROM dynamic_field WHERE name = 'Ubicacion'"
  );
  const value = rows.length ? parseDropdownOptions(String(rows[0].config)) : [];
  siteCache = { at: Date.now(), value };
  return value;
}
