import fs from "fs";
import path from "path";
import { normalizeName } from "../lib/normalizeName";
import { DATA_DIR, SEED_DIR } from "../lib/dataDir";
import { Site } from "../types";
import { migrateSitesV2, RawSite, SitesFileV2 } from "../migrations/sitesV2";

/**
 * Capa de acceso a datos de sitios.
 *
 * Principio general del proyecto: la única información que este dashboard
 * "posee" y osTicket no tiene es la geolocalización (lat/lng) y el tipo de
 * sitio (aduana marítima/terrestre/aérea/sede) — osTicket no tiene concepto
 * de ninguna de las dos. Todo lo demás (qué sitios existen, departamentos,
 * prioridades, estados) se consulta siempre en vivo contra la base real, sin
 * mantener listas propias que se puedan desincronizar.
 *
 * site-metadata.json es por eso la ÚNICA excepción de dato "local" del
 * proyecto: guarda, por nombre de sitio, la asignación de lat/lng/type que
 * un humano tiene que definir (nunca se puede inferir de osTicket). Vive en
 * el servidor y el panel /admin/sites lo edita en producción — por eso el
 * archivo real está en .gitignore y NUNCA debe pisarse con un git pull.
 * site-metadata.seed.json sí se trackea: es solo el punto de partida para
 * una instalación nueva (se copia a site-metadata.json la primera vez que
 * el proceso arranca y ese archivo todavía no existe en el servidor).
 *
 * El endpoint POST /api/admin/sites, aun así, nunca puede "crear" un sitio
 * en el sentido de inventarlo: solo puede asignar coordenadas a un nombre
 * que ya exista en vivo en ost_list_items (ver routes/admin.ts).
 */
const METADATA_PATH = path.join(DATA_DIR, "site-metadata.json");
const SEED_PATH = path.join(SEED_DIR, "site-metadata.seed.json");

type MetadataFile = SitesFileV2;

function readMetadataFile(filePath: string): MetadataFile {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as MetadataFile;
}

function ensureMetadataFileExists(): void {
  if (fs.existsSync(METADATA_PATH)) return;
  console.log(
    `[sitesRepository] site-metadata.json no existe todavía, lo creo a partir del seed (${SEED_PATH}).`
  );
  fs.copyFileSync(SEED_PATH, METADATA_PATH);
}

// schemaVersion: 2 se persiste siempre para que la migración no vuelva a correr.
function writeMetadataFile(sites: RawSite[]): void {
  fs.writeFileSync(
    METADATA_PATH,
    JSON.stringify({ schemaVersion: 2, sites }, null, 2) + "\n",
    "utf-8"
  );
}

function backupSuffix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function toSite(raw: RawSite): Site {
  // El nombre configurado ES el id — no hay ningún id numérico de osTicket
  // que sirva acá, porque un mismo sitio puede aparecer con ids distintos
  // en list_id=2 (Sitio de Aduana) y list_id=7 (CCTV Sitios).
  return {
    id: raw.name,
    name: raw.name,
    type: raw.type as Site["type"],
    lat: raw.lat,
    lng: raw.lng,
    znunyKey: raw.znunyKey ?? null,
  };
}

export interface SitesRepository {
  findAll(): Site[];
  findByNormalizedName(name: string): Site | undefined;
  findByZnunyKey(key: string): Site | undefined;
  /** Asigna type/lat/lng al sitio de esa clave de Znuny (lo crea si no existe). */
  upsertByZnunyKey(input: { znunyKey: string; type: Site["type"]; lat: number; lng: number }): Site;
  upsert(site: RawSite): Site;
  remove(name: string): boolean;
}

class JsonSitesRepository implements SitesRepository {
  private sites: RawSite[];

  constructor() {
    ensureMetadataFileExists();
    const file = readMetadataFile(METADATA_PATH);
    const migrated = migrateSitesV2(file);
    if (migrated.changed) {
      const backup = `${METADATA_PATH}.bak-${backupSuffix()}`;
      fs.copyFileSync(METADATA_PATH, backup);
      console.log(`[sitesRepository] migrando site-metadata.json a v2 (respaldo: ${backup}).`);
      this.sites = migrated.file.sites;
      writeMetadataFile(this.sites);
    } else {
      this.sites = file.sites;
    }
  }

  findAll(): Site[] {
    return this.sites.filter((s) => !s.legacyOnly).map(toSite);
  }

  findByNormalizedName(name: string): Site | undefined {
    const target = normalizeName(name);
    const match = this.sites.find((site) => normalizeName(site.name) === target);
    return match ? toSite(match) : undefined;
  }

  findByZnunyKey(key: string): Site | undefined {
    const match = this.sites.find((s) => !s.legacyOnly && s.znunyKey === key);
    return match ? toSite(match) : undefined;
  }

  upsertByZnunyKey(input: { znunyKey: string; type: Site["type"]; lat: number; lng: number }): Site {
    const index = this.sites.findIndex((s) => s.znunyKey === input.znunyKey);
    if (index >= 0) {
      this.sites[index] = { ...this.sites[index], type: input.type, lat: input.lat, lng: input.lng };
    } else {
      this.sites.push({ name: input.znunyKey, ...input });
    }
    writeMetadataFile(this.sites);
    return toSite(this.sites[index >= 0 ? index : this.sites.length - 1]);
  }

  /** Agrega el sitio o, si ya existe (por nombre normalizado), reemplaza su type/lat/lng. */
  upsert(site: RawSite): Site {
    const target = normalizeName(site.name);
    const index = this.sites.findIndex((s) => normalizeName(s.name) === target);
    if (index >= 0) {
      // Merge: conserva znunyKey/legacyOnly (la ruta admin legacy solo manda name/type/lat/lng).
      this.sites[index] = { ...this.sites[index], type: site.type, lat: site.lat, lng: site.lng };
    } else {
      this.sites.push(site);
    }
    writeMetadataFile(this.sites);
    return toSite(this.sites[index >= 0 ? index : this.sites.length - 1]);
  }

  remove(name: string): boolean {
    const target = normalizeName(name);
    const index = this.sites.findIndex((s) => normalizeName(s.name) === target);
    if (index < 0) return false;
    this.sites.splice(index, 1);
    writeMetadataFile(this.sites);
    return true;
  }
}

export const sitesRepository: SitesRepository = new JsonSitesRepository();
