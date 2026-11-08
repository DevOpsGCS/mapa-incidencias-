/**
 * Migración v2 de site-metadata.json (función pura): agrega znunyKey, la clave
 * del campo dinámico Ubicacion de Znuny. Solo se usa una vez: los sitios sin
 * clave conocida quedan como legacyOnly (solo existen en el histórico osTicket).
 */
export interface RawSite {
  name: string;
  type: string;
  lat: number;
  lng: number;
  znunyKey?: string;
  legacyOnly?: boolean;
}

export interface SitesFileV2 {
  schemaVersion?: number;
  sites: RawSite[];
}

export const SITE_ZNUNY_KEY_OVERRIDES: Record<string, string> = {
  "La Hachadura": "Hachadura",
  "El Amatillo": "Amatillo",
  "El Poy": "Poy",
  "Las Chinamas": "Chinamas",
  "Santa Elena Oficina Central": "Santa Elena",
  "Oficina de la Diaspora": "Oficina Diaspora",
};

/** Claves de Ubicacion en Znuny al 8-nov-2026. */
export const KNOWN_ZNUNY_KEYS = [
  "Acajutla",
  "Aeropuerto Internacional",
  "Aeropuerto Terminal de Carga",
  "Aeropuerto Terminal de Pasajeros",
  "Amatillo",
  "Anguiatu",
  "Chinamas",
  "Hachadura",
  "Oficina Diaspora",
  "Poy",
  "San Bartolo",
  "San Cristobal",
  "San Francisco",
  "Santa Elena",
];

// normalizeName (lib) no quita tildes y acá hacen falta ("Anguiatú" vs "Anguiatu").
function fold(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function migrateSitesV2(file: SitesFileV2): { changed: boolean; file: SitesFileV2 } {
  if ((file.schemaVersion ?? 1) >= 2) return { changed: false, file };
  const sites = file.sites.map((site): RawSite => {
    if (site.znunyKey !== undefined || site.legacyOnly) return site;
    const override = SITE_ZNUNY_KEY_OVERRIDES[site.name];
    if (override) return { ...site, znunyKey: override };
    const target = fold(site.name);
    const known = KNOWN_ZNUNY_KEYS.find((key) => fold(key) === target);
    if (known) return { ...site, znunyKey: known };
    return { ...site, legacyOnly: true };
  });
  return { changed: true, file: { ...file, schemaVersion: 2, sites } };
}
