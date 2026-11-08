import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { queueIcon } from "./queueIcons";
import { PriorityPresence, QueueCount } from "./siteDominance";

// --- Geometría del marcador -------------------------------------------
// Todo el marcador (principal + secundarios) debe caber en un cuadrado fijo
// de 90x90px, sin que ningún elemento se salga de ese límite (para no
// encimarse con marcadores de sitios vecinos, sobre todo entre aduanas
// terrestres geográficamente cercanas). Los números de abajo están
// calculados para respetar ese límite con margen de seguridad:
//
//   WRAPPER_SIZE 90 · MAIN_SIZE 56 → margen de 17px a cada lado del
//   ícono principal, centrado. Los 3 secundarios (20px) cascadean hacia
//   la esquina inferior derecha DEL ÍCONO PRINCIPAL (no del wrapper) con
//   bottom/right negativos crecientes de a 8px — el más lejano llega a
//   -16px, es decir a 73+16=89px del origen del wrapper: 1px de margen
//   real, sin redondeos ni subpíxeles de por medio (todos los valores son
//   enteros), así que es un límite exacto, no aproximado.
const WRAPPER_SIZE = 90;
const MAIN_SIZE = 56;
const MAIN_OFFSET = (WRAPPER_SIZE - MAIN_SIZE) / 2; // 17
const MAIN_CENTER = WRAPPER_SIZE / 2; // 45 == centro del ícono principal

// Aro segmentado: círculo interior más chico centrado con padding fijo, así
// el conic-gradient del exterior se ve como un donut y no como un relleno
// sólido. El interior NO cambia el "containing block" de los secundarios:
// siguen colgando del cuadro exterior de 56px, exactamente como antes.
const RING_WIDTH = 3;
const INNER_SIZE = MAIN_SIZE - RING_WIDTH * 2; // 50

const SECONDARY_SIZE = 20;
const SECONDARY_STEP = 8; // cascada ~43% de superposición entre secundarios consecutivos
const MAX_SECONDARY_SLOTS = 3;

const iconCache = new Map<string, L.DivIcon>();

/**
 * Aro de prioridad: 4 cuadrantes fijos en sentido horario desde las 12
 * (rank 0 = la más alta, rank 1, rank 2, rank ≥ 3), con los mismos colores
 * que priorityColor. Cada cuadrante se pinta SOLO si esa prioridad tiene al
 * menos un ticket abierto en el sitio; si no, queda en gris neutro
 * (var(--border)). No es proporcional a la cantidad de tickets.
 */
function priorityRingBackground(presence: PriorityPresence): string {
  const [top, high, normal, low] = presence;
  const c0 = top ? "var(--fill-danger)" : "var(--border)";
  const c1 = high ? "var(--fill-warning)" : "var(--border)";
  const c2 = normal ? "var(--fill-accent)" : "var(--border)";
  const c3 = low ? "var(--fill-success)" : "var(--border)";
  return `conic-gradient(from 0deg, ${c0} 0% 25%, ${c1} 25% 50%, ${c2} 50% 75%, ${c3} 75% 100%)`;
}

/**
 * Construye el marcador compuesto de un sitio: un ícono principal (el
 * cola raíz con más tickets abiertos, con un aro segmentado en 4
 * cuadrantes de prioridad) más hasta 3 íconos secundarios apilados tipo
 * "fichas de dominó" sobre la esquina inferior derecha del principal, para
 * los siguientes colas con tickets abiertos. Si sobran más de 3
 * colas adicionales, el último slot se reemplaza por un badge "+N"
 * en vez de un tercer ícono.
 *
 * Se reconstruye en cada render con los datos vigentes (queueCounts y
 * priorityPresence vienen de useMemo atados al array de tickets), así que
 * refleja automáticamente los eventos ticket:new/ticket:updated de
 * socket.io.
 */
export function buildSiteMarkerIcon(
  queueCounts: QueueCount[],
  priorityPresence: PriorityPresence,
  selected: boolean,
  siteId?: string
): L.DivIcon {
  const cacheKey = `${siteId}|${JSON.stringify(queueCounts)}|${JSON.stringify(priorityPresence)}|${selected}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const [dominant, ...additional] = queueCounts;

  const DominantIcon = queueIcon(dominant?.queue);
  const mainGlyph = renderToStaticMarkup(
    <DominantIcon size={Math.round(INNER_SIZE * 0.5)} color="var(--text)" stroke={2} />
  );

  const selectedRing = selected ? "0 0 0 3px rgba(62,214,196,0.55)," : "";
  const hasOpenTickets = priorityPresence.some(Boolean);
  // Rojo pulsante para sitios con la prioridad máxima abierta (ver .marker-pulse); azul
  // más sutil para sitios con cualquier otro ticket abierto, así se
  // distingue de un sitio realmente sin nada pendiente (sin glow).
  const pulseClass = priorityPresence[0]
    ? "marker-pulse"
    : hasOpenTickets
      ? "marker-pulse-open"
      : "";

  // Máximo 3 slots secundarios en total: si hay más de 3 colas
  // adicionales, los primeros 2 se muestran como íconos y el 3er slot se
  // convierte en el badge "+N" (nunca se agrega un 4to elemento).
  const showBadge = additional.length > MAX_SECONDARY_SLOTS;
  const iconsToShow = showBadge
    ? additional.slice(0, MAX_SECONDARY_SLOTS - 1)
    : additional.slice(0, MAX_SECONDARY_SLOTS);
  const overflowCount = showBadge ? additional.length - iconsToShow.length : 0;

  let secondaryHtml = "";
  iconsToShow.forEach((entry, index) => {
    const edge = index * SECONDARY_STEP; // 0, 8, 16...
    const SecondaryIcon = queueIcon(entry.queue);
    const glyph = renderToStaticMarkup(
      <SecondaryIcon
        size={Math.round(SECONDARY_SIZE * 0.55)}
        color="var(--text)"
        stroke={2.25}
      />
    );
    secondaryHtml += `<div style="
        position:absolute;bottom:-${edge}px;right:-${edge}px;z-index:${10 + index};
        width:${SECONDARY_SIZE}px;height:${SECONDARY_SIZE}px;border-radius:9999px;
        display:flex;align-items:center;justify-content:center;
        background:var(--map-line);
        border:2px solid var(--map-bg);
      ">${glyph}</div>`;
  });

  if (overflowCount > 0) {
    const edge = iconsToShow.length * SECONDARY_STEP;
    secondaryHtml += `<div style="
        position:absolute;bottom:-${edge}px;right:-${edge}px;z-index:${10 + iconsToShow.length};
        width:${SECONDARY_SIZE}px;height:${SECONDARY_SIZE}px;border-radius:9999px;
        display:flex;align-items:center;justify-content:center;
        background:var(--map-line);
        border:2px solid var(--map-bg);
        font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;color:var(--cyan);
      ">+${overflowCount}</div>`;
  }

  // El cuadro exterior (position:absolute, 56x56) sigue siendo el
  // "containing block" de referencia para los secundarios — el aro donut
  // (conic-gradient + círculo interior) es puramente visual y no cambia
  // esa geometría en absoluto.
  const html = `<div data-site-marker="${siteId ?? ""}" data-secondary-count="${iconsToShow.length}" style="position:relative;width:${WRAPPER_SIZE}px;height:${WRAPPER_SIZE}px;transform:scale(var(--hud-zoom,1));transform-origin:${MAIN_CENTER}px ${MAIN_CENTER}px;">
      <div class="${pulseClass}" style="
        position:absolute;left:${MAIN_OFFSET}px;top:${MAIN_OFFSET}px;z-index:5;
        width:${MAIN_SIZE}px;height:${MAIN_SIZE}px;border-radius:9999px;
        background:${priorityRingBackground(priorityPresence)};
        box-shadow:${selectedRing} 0 0 0 2px rgba(11,18,32,0.7);
      ">
        <div style="
          position:absolute;left:${RING_WIDTH}px;top:${RING_WIDTH}px;
          width:${INNER_SIZE}px;height:${INNER_SIZE}px;border-radius:9999px;
          display:flex;align-items:center;justify-content:center;
          background:var(--surface-1);
        ">${mainGlyph}</div>
        ${secondaryHtml}
      </div>
    </div>`;

  const icon = L.divIcon({
    html,
    className: "",
    iconSize: [WRAPPER_SIZE, WRAPPER_SIZE],
    iconAnchor: [MAIN_CENTER, MAIN_CENTER],
    popupAnchor: [0, -MAIN_CENTER],
  });

  iconCache.set(cacheKey, icon);
  return icon;
}
