import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { MapHeroView } from "./components/MapHeroView";
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
    notifications,
    dismissNotification,
  } = useDashboardData();
  const [view, setView] = useState<DashboardView>("map");
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  return (
    <div className="h-screen overflow-hidden bg-[color:var(--map-bg)]">
      <TopBar
        view={view}
        onViewChange={setView}
        connected={connected}
        lastHeartbeatAt={lastHeartbeatAt}
        isAdmin={user?.role === "admin"}
        onOpenAdmin={() => navigate("/admin/sites")}
        onLogout={logout}
      />
      <NotificationStack
        notifications={notifications}
        catalog={catalog}
        onDismiss={dismissNotification}
      />

      {queueAccess === "none" && <NoQueueAccessBanner />}

      {error && (
        <div className="hud-scale fixed left-1/2 top-[78px] z-40 -translate-x-1/2 rounded-lg border border-[#FF4D6D]/40 bg-[#2a0f16]/90 px-4 py-2 text-sm text-[#ff8fa3]">
          Error cargando datos: {error}.
          {/* Solo un fallo de red (sin respuesta del backend) sugiere revisar la API local. */}
          {/failed to fetch|networkerror|load failed/i.test(error) &&
            " Verifica que la API esté corriendo en el puerto 4000."}
        </div>
      )}

      {loading || !stats || !catalog ? (
        <div className="mono-label flex h-full items-center justify-center text-xs text-[color:var(--muted)]">
          Cargando dashboard...
        </div>
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
