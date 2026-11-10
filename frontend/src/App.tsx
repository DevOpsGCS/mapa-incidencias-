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
import { DevNotificationTester } from "./components/DevNotificationTester";
import { TopBar, DashboardView } from "./components/TopBar";
import { bannerState } from "./lib/bannerState";
import { useDashboardData } from "./hooks/useDashboardData";
import { Site } from "./types";
import { MapBackdrop } from "./components/MapBackdrop";

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
    demoNotification,
    refresh,
  } = useDashboardData();
  // El 503 del backend dice lo mismo que el aviso de mesa caída: mostrar solo uno.
  const { deskDown, genericError } = bannerState(error, serviceDeskOk);
  const [view, setView] = useState<DashboardView>("map");
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  return (
    <div className="isolate h-screen overflow-hidden bg-bg">
      {/* Fuera del mapa en vivo, el mapa desenfocado queda detrás del vidrio. */}
      {view !== "map" && <MapBackdrop />}
      <TopBar
        view={view}
        onViewChange={setView}
        connected={connected}
        lastHeartbeatAt={lastHeartbeatAt}
        serviceDeskOk={serviceDeskOk}
        isAdmin={user?.role === "admin"}
        onOpenAdmin={() => navigate("/admin")}
        onLogout={logout}
      />
      {/* Solo en desarrollo (npm run dev): Vite elimina este bloque del build de producción. */}
      {import.meta.env.DEV && <DevNotificationTester onTest={demoNotification} />}
      <NotificationStack
        notifications={notifications}
        catalog={catalog}
        onDismiss={dismissNotification}
      />

      {/* Avisos apilados en un único contenedor fijo (antes compartían top y se tapaban). */}
      {(queueAccess === "none" || genericError || deskDown) && (
        <div className="hud-scale pointer-events-none fixed left-1/2 top-[78px] z-40 flex -translate-x-1/2 flex-col items-center gap-2">
          {queueAccess === "none" && <NoQueueAccessBanner />}
          {genericError && (
            <div className="flex items-center gap-2.5 rounded-full bg-surface-3 px-4 py-2 text-sm text-text-strong">
              <IconAlertTriangle size={16} stroke={2} style={{ color: "var(--data-p0)" }} />
              Error cargando datos: {genericError}.
              {/* Solo un fallo de red (sin respuesta del backend) sugiere revisar la API local. */}
              {/failed to fetch|networkerror|load failed/i.test(genericError) &&
                " Verifica que la API esté corriendo en el puerto 4000."}
            </div>
          )}
          {deskDown && (
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
        <MetricsView
          tickets={tickets}
          sites={sites}
          stats={stats}
          catalog={catalog}
          lastHeartbeatAt={lastHeartbeatAt}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
