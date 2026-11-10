import { ReactNode } from "react";
import { MapBackdrop } from "../components/MapBackdrop";
import logo from "../img/logo_gcs_blanco.png";

/** Clases compartidas por las pantallas de auth (inputs, botón primario, links). */
export const AUTH_LABEL_CLASS = "block text-sm text-text-muted";
export const AUTH_INPUT_CLASS =
  "mt-1 w-full rounded-[6px] bg-surface-2 px-3 py-2 text-text-strong outline-none focus:ring-1 focus:ring-accent";
export const AUTH_PASSWORD_INPUT_CLASS =
  "rounded-[6px] bg-surface-2 px-3 py-2 text-text-strong outline-none focus:ring-1 focus:ring-accent";
export const AUTH_PRIMARY_BUTTON_CLASS =
  "w-full rounded-full bg-accent-fill px-4 py-2.5 text-sm font-medium text-text-strong transition-opacity hover:opacity-90 disabled:opacity-50";
export const AUTH_LINK_CLASS = "block w-full text-center text-xs text-text-muted hover:text-text-strong";
export const AUTH_ERROR_CLASS = "text-sm";
export const AUTH_ERROR_STYLE = { color: "var(--data-p0-text)" } as const;

interface AuthBackgroundProps {
  children: ReactNode;
  /** Subtítulo de la pantalla (p. ej. "Recuperar contraseña"); el título de la app es fijo. */
  heading?: string;
}

/**
 * Fondo y tarjeta compartidos por las pantallas de auth (login, "olvidé mi
 * contraseña", restablecer). Detrás, la captura estática y desenfocada del
 * mapa (MapBackdrop): nunca datos en vivo, porque mostrar el mapa real antes
 * de loguearse expondría /api/tickets y /api/sites sin autenticación.
 */
export function AuthBackground({ children, heading }: AuthBackgroundProps) {
  return (
    <div className="relative isolate flex h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <MapBackdrop />
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
