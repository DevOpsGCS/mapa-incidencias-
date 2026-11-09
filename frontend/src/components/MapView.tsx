import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { CountryBoundary } from "./CountryBoundary";
import { MapZoomControls } from "./MapZoomControls";
import { countryFitOptions, EL_SALVADOR_BOUNDS } from "../lib/mapFraming";
import { buildSiteMarkerIcon } from "../lib/siteMarkerIcon";
import { EMPTY_PRESENCE, PriorityPresence, QueueCount } from "../lib/siteDominance";
import { siteImageUrl } from "../lib/siteImages";
import { Site } from "../types";

interface MapViewProps {
  sites: Site[];
  queueBreakdownBySite: Map<string, QueueCount[]>;
  sitePriorityPresenceById: Map<string, PriorityPresence>;
  selectedSiteId?: string;
  onSelectSite: (site: Site) => void;
}

const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY;
const CARTO_TILE_URL = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${
  CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : ""
}`;

export function MapView({
  sites,
  queueBreakdownBySite,
  sitePriorityPresenceById,
  selectedSiteId,
  onSelectSite,
}: MapViewProps) {
  return (
    <div className="relative h-full w-full">
      <MapContainer
        bounds={EL_SALVADOR_BOUNDS}
        boundsOptions={countryFitOptions()}
        zoomSnap={0.25}
        minZoom={8}
        zoomControl={false}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={CARTO_TILE_URL}
        />
        <CountryBoundary />
        {/* zoomControl nativo desactivado por estética; estos botones grandes
            son necesarios en navegadores de TV, que no tienen rueda ni pinch. */}
        <MapZoomControls homeBounds={EL_SALVADOR_BOUNDS} />
        {sites.map((site) => {
          const queueCounts = queueBreakdownBySite.get(site.id) ?? [];
          const priorityPresence = sitePriorityPresenceById.get(site.id) ?? EMPTY_PRESENCE;
          const isSelected = site.id === selectedSiteId;

          return (
            <Marker
              key={site.id}
              position={[site.lat, site.lng]}
              icon={buildSiteMarkerIcon(
                queueCounts,
                priorityPresence,
                isSelected,
                site.id,
                siteImageUrl(site.znunyKey)
              )}
              eventHandlers={{ click: () => onSelectSite(site) }}
            />
          );
        })}
      </MapContainer>
      {/* Viñeta: hermana del MapContainer (no dentro del contenedor de Leaflet).
          El map-pane de Leaflet es un stacking context en z 400, así que la viñeta
          (z 401) queda por encima de todo el mapa, marcadores incluidos, y por debajo
          de los controles (1000) y los paneles HUD. Por eso es suave: solo los
          atenúa apenas cerca de los bordes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 80px 24px var(--bg)", zIndex: 401 }}
      />
    </div>
  );
}
