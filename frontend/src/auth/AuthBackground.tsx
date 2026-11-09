import { ReactNode, useEffect, useState } from "react";
import logo from "../img/logo_gcs_blanco.png";

const BOUNDARY_URL = "/data/el-salvador-boundary.geojson";
const VIEW_W = 1000;
const VIEW_H = 620;

/** Clases compartidas por las pantallas de auth (inputs, botón primario, links). */
export const AUTH_LABEL_CLASS = "block text-sm text-text-muted";
export const AUTH_INPUT_CLASS =
  "mt-1 w-full rounded-[6px] border border-line-strong bg-surface-2 px-3 py-2 text-text-strong outline-none focus:border-accent";
export const AUTH_PASSWORD_INPUT_CLASS =
  "rounded-[6px] border border-line-strong bg-surface-2 px-3 py-2 text-text-strong outline-none focus:border-accent";
export const AUTH_PRIMARY_BUTTON_CLASS =
  "w-full rounded-full bg-accent-fill px-4 py-2.5 text-sm font-medium text-text-strong transition-opacity hover:opacity-90 disabled:opacity-50";
export const AUTH_LINK_CLASS = "block w-full text-center text-xs text-text-muted hover:text-text-strong";
export const AUTH_ERROR_CLASS = "text-sm";
export const AUTH_ERROR_STYLE = { color: "var(--data-p0-text)" } as const;

type Ring = number[][];

/** Proyecta (lng, lat) a un path SVG ajustado al viewBox, conservando la proporción. */
function boundaryToPath(geo: GeoJSON.FeatureCollection): string {
  const rings: Ring[] = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (g.type === "Polygon") rings.push(...(g.coordinates as Ring[]));
    else if (g.type === "MultiPolygon") for (const poly of g.coordinates as Ring[][]) rings.push(...poly);
  }
  const pts = rings.flat();
  if (!pts.length) return "";
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const minX = Math.min(...lngs);
  const maxX = Math.max(...lngs);
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const scale = Math.min((VIEW_W * 0.9) / (maxX - minX), (VIEW_H * 0.9) / (maxY - minY));
  const offX = (VIEW_W - (maxX - minX) * scale) / 2;
  const offY = (VIEW_H - (maxY - minY) * scale) / 2;
  return rings
    .map(
      (ring) =>
        ring
          .map(
            ([x, y], i) =>
              `${i ? "L" : "M"}${(offX + (x - minX) * scale).toFixed(1)} ${(offY + (maxY - y) * scale).toFixed(1)}`
          )
          .join("") + "Z"
    )
    .join("");
}

/** Contorno de El Salvador (archivo estático público, sin datos del dashboard) a opacidad .15. */
function BoundaryBackdrop() {
  const [path, setPath] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(BOUNDARY_URL)
      .then((r) => r.json())
      .then((geo: GeoJSON.FeatureCollection) => {
        if (!cancelled) setPath(boundaryToPath(geo));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!path) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full text-accent"
      style={{ opacity: 0.15 }}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

interface AuthBackgroundProps {
  children: ReactNode;
  /** Subtítulo de la pantalla (p. ej. "Recuperar contraseña"); el título de la app es fijo. */
  heading?: string;
}

/**
 * Fondo y tarjeta compartidos por las pantallas de auth (login, "olvidé mi
 * contraseña", restablecer). Solo contenido estático: nunca datos en vivo,
 * porque mostrar el mapa real antes de loguearse expondría /api/tickets y
 * /api/sites sin autenticación.
 */
export function AuthBackground({ children, heading }: AuthBackgroundProps) {
  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <BoundaryBackdrop />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 160px 60px var(--bg)" }}
      />
      <div className="relative z-10 w-full max-w-[400px] space-y-6 rounded-[24px] glass p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="Global Customs Solutions" className="h-10 w-auto" />
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-text-strong">Mapa de Incidencias</h1>
            <p className="mt-1 font-mono text-xs text-text-label">Global Customs Solutions · Mesa de Servicio</p>
            {heading && <p className="mt-3 text-sm font-medium text-text">{heading}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
