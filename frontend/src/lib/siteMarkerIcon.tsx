import L from "leaflet";
import { PriorityPresence, QueueCount } from "./siteDominance";
import { buildSiteMarkerHtml, MAIN_CENTER, MARKER_WRAPPER_SIZE } from "./siteMarkerHtml";

const iconCache = new Map<string, L.DivIcon>();

/**
 * Marcador compuesto de un sitio como L.DivIcon (ver buildSiteMarkerHtml
 * para el diseño: foto del sitio + aro de prioridad + insignia de la cola
 * dominante + fichas de las demás colas).
 *
 * Se reconstruye en cada render con los datos vigentes (queueCounts y
 * priorityPresence vienen de useMemo atados al array de tickets), así que
 * refleja automáticamente los eventos de socket.io; el caché evita crear
 * un DivIcon nuevo cuando nada cambió.
 */
export function buildSiteMarkerIcon(
  queueCounts: QueueCount[],
  priorityPresence: PriorityPresence,
  selected: boolean,
  siteId: string | undefined,
  imageUrl: string | null,
  siteName?: string
): L.DivIcon {
  const cacheKey = `${siteId}|${siteName}|${imageUrl}|${JSON.stringify(queueCounts)}|${JSON.stringify(priorityPresence)}|${selected}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const icon = L.divIcon({
    html: buildSiteMarkerHtml({ queueCounts, priorityPresence, selected, siteId, imageUrl, siteName }),
    className: "",
    iconSize: [MARKER_WRAPPER_SIZE, MARKER_WRAPPER_SIZE],
    iconAnchor: [MAIN_CENTER, MAIN_CENTER],
    popupAnchor: [0, -MAIN_CENTER],
  });

  iconCache.set(cacheKey, icon);
  return icon;
}
