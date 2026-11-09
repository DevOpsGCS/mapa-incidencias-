import { IconAlertTriangle, IconPlugConnectedX } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { LegacyView } from "./legacy/LegacyView";
import { MapHeroView } from "./components/MapHeroView";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { MetricsView } from "./components/MetricsView";
import { NoQueueAccessBanner } from "./components/NoQueueAccessBanner";
import { NotificationStack } from "./components/NotificationStack";
import { TopBar, DashboardView } from "./components/TopBar";
import { useDashboardData } from "./hooks/useDashboardData";
import { Site } from "./types";

export default function App() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    sites,
    tickets,
    stats,
    catalog,
    queueAccess,
    loading,
    error,
    connected,
    lastHeartbeatAt,
    serviceDeskOk,
    notifications,
    dismissNotification,
  } = useDashboardData();
  const [view, setView] = useState<DashboardView>("map");
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  return (
    <div className="h-screen overflow-hidden bg-bg">
      <TopBar
        view={view}
        onViewChange={setView}
        connected={connected}
        lastHeartbeatAt={lastHeartbeatAt}
        serviceDeskOk={serviceDeskOk}
        isAdmin={user?.role === "admin"}
        onOpenAdmin={() => navigate("/admin/sites")}
        onLogout={logout}
      />
      <NotificationStack
        notifications={notifications}
        catalog={catalog}
        onDismiss={dismissNotification}
      />

      {/* Avisos apilados en un único contenedor fijo (antes compartían top y se tapaban). */}
      {(queueAccess === "none" || error || !serviceDeskOk) && (
        <div className="hud-scale pointer-events-none fixed left-1/2 top-[78px] z-40 flex -translate-x-1/2 flex-col items-center gap-2">
          {queueAccess === "none" && <NoQueueAccessBanner />}
          {error && (
            <div className="flex items-center gap-2.5 rounded-full bg-surface-3 px-4 py-2 text-sm text-text-strong">
              <IconAlertTriangle size={16} stroke={2} style={{ color: "var(--data-p0)" }} />
              Error cargando datos: {error}.
              {/* Solo un fallo de red (sin respuesta del backend) sugiere revisar la API local. */}
              {/failed to fetch|networkerror|load failed/i.test(error) &&
                " Verifica que la API esté corriendo en el puerto 4000."}
            </div>
          )}
          {!serviceDeskOk && (
            <div className="flex items-center gap-2.5 rounded-full bg-surface-3 px-4 py-2 text-sm text-text-strong">
              <IconPlugConnectedX size={16} stroke={2} style={{ color: "var(--data-p1)" }} />
              Mesa de Servicio no disponible; los datos pueden estar desactualizados.
            </div>
          )}
        </div>
      )}

      {view === "legacy" ? (
        <div className="h-full">
          <LegacyView />
        </div>
      ) : loading || !stats || !catalog ? (
        <LoadingSkeleton />
      ) : view === "map" ? (
        <MapHeroView
          sites={sites}
          tickets={tickets}
          catalog={catalog}
          selectedSite={selectedSite}
          onSelectSite={setSelectedSite}
        />
      ) : (
        <MetricsView tickets={tickets} sites={sites} stats={stats} catalog={catalog} />
      )}
    </div>
  );
}
