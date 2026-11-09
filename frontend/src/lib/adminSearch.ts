import { AdminUserSummary, Site } from "../types";

export interface AdminSearchResult {
  kind: "user" | "site";
  id: string;
  label: string;
}

const MAX_RESULTS = 8;

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Buscador global del panel admin: usuarios (por usuario o correo) y sitios (por nombre). Sin mayúsculas ni tildes; máximo 8. */
export function searchAdmin(query: string, users: AdminUserSummary[], sites: Site[]): AdminSearchResult[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const results: AdminSearchResult[] = [];
  for (const u of users) {
    if (normalize(u.username).includes(q) || normalize(u.email).includes(q)) {
      results.push({ kind: "user", id: u.username, label: u.username });
    }
  }
  for (const s of sites) {
    if (normalize(s.name).includes(q)) {
      results.push({ kind: "site", id: s.id, label: s.name });
    }
  }
  return results.slice(0, MAX_RESULTS);
}
