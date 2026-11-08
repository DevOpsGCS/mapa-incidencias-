import { credentialedRequest } from "./client";
import { AdminUserSummary, Catalog, Role, Site, SiteType } from "../types";

function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return credentialedRequest<T>(`/api/admin${path}`, init);
}

export function fetchConfiguredSites(): Promise<Site[]> {
  return adminRequest<Site[]>("/sites");
}

/** Sitios configurados con el nombre visible en vivo (etiqueta de Znuny); `/api/admin/sites` solo trae el nombre guardado. */
export function fetchSitesWithLiveLabels(): Promise<Site[]> {
  return credentialedRequest<Site[]>("/api/sites");
}

export interface UnmappedSite {
  key: string;
  label: string;
}

/** Opciones de Ubicacion de Znuny sin tipo ni coordenadas todavía. */
export function fetchUnmappedSites(): Promise<UnmappedSite[]> {
  return adminRequest<UnmappedSite[]>("/sites/unmapped");
}

export interface SaveSitePayload {
  znunyKey: string;
  type: SiteType;
  lat: number;
  lng: number;
}

export function saveSite(payload: SaveSitePayload): Promise<Site> {
  return adminRequest<Site>("/sites", { method: "POST", body: JSON.stringify(payload) });
}

/** Catálogo de colas de Znuny (503 si Znuny no está disponible). */
export function fetchAdminQueues(): Promise<Catalog["queues"]> {
  return adminRequest<Catalog["queues"]>("/queues");
}

export function deleteSite(name: string): Promise<{ ok: true }> {
  return adminRequest(`/sites/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export function fetchUsers(): Promise<AdminUserSummary[]> {
  return adminRequest<AdminUserSummary[]>("/users");
}

/** Departamentos de osTicket (en vivo de ost_department, o del snapshot si osTicket está apagado) para el selector del panel — nunca hardcodear la lista. */
export function fetchDepartments(): Promise<string[]> {
  return adminRequest<string[]>("/departments");
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  role: Role;
  /** Vacío/omitido = sin restricción, ve todos los departamentos. */
  allowedDepartments?: string[];
  /** `[]` = todas las colas; `null` = sin acceso. */
  allowedQueues?: string[] | null;
}

export function createUser(payload: CreateUserPayload): Promise<AdminUserSummary> {
  return adminRequest<AdminUserSummary>("/users", { method: "POST", body: JSON.stringify(payload) });
}

export function setUserRole(username: string, role: Role): Promise<AdminUserSummary> {
  return adminRequest<AdminUserSummary>(`/users/${encodeURIComponent(username)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export interface UpdateUserProfilePayload {
  username?: string;
  email?: string;
  allowedDepartments?: string[];
  allowedQueues?: string[] | null;
}

export function updateUserProfile(
  username: string,
  payload: UpdateUserProfilePayload
): Promise<AdminUserSummary> {
  return adminRequest<AdminUserSummary>(`/users/${encodeURIComponent(username)}/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function setUserPassword(username: string, password: string): Promise<{ ok: true }> {
  return adminRequest(`/users/${encodeURIComponent(username)}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });
}

export function deleteUser(username: string): Promise<{ ok: true }> {
  return adminRequest(`/users/${encodeURIComponent(username)}`, { method: "DELETE" });
}
