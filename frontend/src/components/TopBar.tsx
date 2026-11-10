import { IconChevronRight, IconLogout } from "@tabler/icons-react";
import { ReactNode } from "react";
import logo from "../img/logo_gcs_blanco.png";
import serviceDeskLogo from "../img/GCS_logo_nuevo_font_transparente.svg";
import { SoundToggle } from "./SoundToggle";
import { SyncStatus } from "./SyncStatus";

export type DashboardView = "map" | "metrics" | "legacy";

interface TopBarProps {
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
  connected: boolean;
  lastHeartbeatAt: Date | null;
  serviceDeskOk: boolean;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export function TopBar({
  view,
  onViewChange,
  connected,
  lastHeartbeatAt,
  serviceDeskOk,
  isAdmin,
  onOpenAdmin,
  onLogout,
}: TopBarProps) {
  return (
    <header className="hud-scale fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between gap-4 px-5">
      <div className="flex items-center gap-3">
        <img src={logo} alt="Global Customs Solutions" className="h-8 w-auto" />
        {/* El SVG original es azul marino (no se lee sobre el tema oscuro): se pinta en blanco
            como el logo de GCS. El SVG trae mucho margen interno, por eso el tamaño grande. */}
        <img
          src={serviceDeskLogo}
          alt="Mesa de Servicio"
          title="Mesa de Servicio"
          className="h-[52px] w-[52px] flex-shrink-0"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <div>
          <h1 className="text-[15px] font-bold leading-tight text-text-strong">Mapa de Incidencias</h1>
          <p className="mono-label mt-0.5 font-mono text-[10px] text-text-label">
            EL SALVADOR · MESA DE SERVICIO
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-1.5">
          <ViewButton active={view === "map"} onClick={() => onViewChange("map")}>
            Mapa
          </ViewButton>
          <ViewButton active={view === "metrics"} onClick={() => onViewChange("metrics")}>
            Métricas
          </ViewButton>
          <ViewButton active={view === "legacy"} onClick={() => onViewChange("legacy")}>
            Histórico osTicket
          </ViewButton>
        </nav>
        <SoundToggle />
        <SyncStatus connected={connected} lastHeartbeatAt={lastHeartbeatAt} serviceDeskOk={serviceDeskOk} />
        {isAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            aria-label="Acceso administrador"
            title="Acceso administrador"
            className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-surface-2 text-text transition-colors hover:text-text-strong"
          >
            <IconChevronRight size={16} stroke={2} />
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-surface-2 text-text transition-colors hover:text-text-strong"
        >
          <IconLogout size={16} stroke={2} />
        </button>
      </div>
    </header>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? { boxShadow: "var(--glow-select)" } : undefined}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "bg-accent-fill text-text-strong"
          : "bg-surface-2 text-text hover:bg-surface-3 hover:text-text-strong"
      }`}
    >
      {children}
    </button>
  );
}
