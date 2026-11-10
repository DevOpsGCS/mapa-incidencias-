import { renderToStaticMarkup } from "react-dom/server";
import { queueIcon } from "./queueIcons";
import { PriorityPresence, QueueCount } from "./siteDominance";

// --- Geometría del marcador -------------------------------------------
// Todo el marcador (principal + insignia + secundarios) debe caber en un
// cuadrado fijo de 90x90px, sin que ningún elemento se salga de ese límite
// (para no encimarse con marcadores de sitios vecinos, sobre todo entre
// aduanas terrestres geográficamente cercanas):
//
//   WRAPPER_SIZE 90 · MAIN_SIZE 56 → margen de 17px a cada lado del
//   ícono principal, centrado. Los 3 secundarios (26px) cascadean hacia
//   la esquina inferior derecha DEL ÍCONO PRINCIPAL con bottom/right
//   negativos crecientes de a 8px — el más lejano llega a 73+16=89px.
//   La insignia de la cola dominante (32px) cuelga de la esquina superior
//   izquierda del principal con top/left -8px → empieza en 17-8=9px.
const WRAPPER_SIZE = 90;
const MAIN_SIZE = 56;
const MAIN_OFFSET = (WRAPPER_SIZE - MAIN_SIZE) / 2; // 17
export const MAIN_CENTER = WRAPPER_SIZE / 2; // 45 == centro del ícono principal
export const MARKER_WRAPPER_SIZE = WRAPPER_SIZE;

// Forma de pin de ubicación (decisión del usuario 10-nov): una punta debajo
// del círculo. La punta es el ANCLA del marcador: apoya en la coordenada real
// del sitio, así que el círculo queda arriba del punto, como un pin de mapa.
const TAIL_HALF_WIDTH = 10;
const TAIL_HEIGHT = 16;
const TAIL_TOP = MAIN_OFFSET + MAIN_SIZE - 4; // 69: se mete un poco bajo el aro
/** y (dentro del wrapper) de la punta del pin = ancla en el mapa. */
export const MARKER_TIP_Y = TAIL_TOP + TAIL_HEIGHT; // 85

// Aro segmentado: círculo interior más chico centrado con padding fijo, así
// el conic-gradient del exterior se ve como un donut y no como un relleno
// sólido.
const RING_WIDTH = 3;
const INNER_SIZE = MAIN_SIZE - RING_WIDTH * 2; // 50

// 10-nov: insignia y fichas más grandes (pedido del usuario): 24→32 y 20→26.
const SECONDARY_SIZE = 26;
const SECONDARY_STEP = 8; // cascada ~43% de superposición entre secundarios consecutivos
const MAX_SECONDARY_SLOTS = 3;

const BADGE_SIZE = 32;
const BADGE_OFFSET = 8;
// La etiqueta del nombre termina 2px por encima de la insignia (y = 9 dentro del wrapper).
const LABEL_BOTTOM_Y = MAIN_OFFSET - BADGE_OFFSET - 2;
/** Distancia (sin zoom de TV) del ancla del marcador (la punta del pin) al borde inferior de la etiqueta. */
export const LABEL_ABOVE_ANCHOR = MARKER_TIP_Y - LABEL_BOTTOM_Y;

/** Color de la punta: la prioridad más alta con tickets abiertos; gris si no hay. */
function tailColor(presence: PriorityPresence): string {
  const [top, high, normal, low] = presence;
  if (top) return "var(--fill-danger)";
  if (high) return "var(--fill-warning)";
  if (normal) return "var(--fill-accent)";
  if (low) return "var(--fill-success)";
  return "var(--line-strong)";
}

/**
 * Aro de prioridad: 4 cuadrantes fijos en sentido horario desde las 12
 * (rank 0 = la más alta, rank 1, rank 2, rank ≥ 3), con los mismos colores
 * que priorityColor. Cada cuadrante se pinta SOLO si esa prioridad tiene al
 * menos un ticket abierto en el sitio; si no, queda en gris neutro
 * (var(--line-strong)). No es proporcional a la cantidad de tickets.
 */
function priorityRingBackground(presence: PriorityPresence): string {
  const [top, high, normal, low] = presence;
  const c0 = top ? "var(--fill-danger)" : "var(--line-strong)";
  const c1 = high ? "var(--fill-warning)" : "var(--line-strong)";
  const c2 = normal ? "var(--fill-accent)" : "var(--line-strong)";
  const c3 = low ? "var(--fill-success)" : "var(--line-strong)";
  return `conic-gradient(from 0deg, ${c0} 0% 25%, ${c1} 25% 50%, ${c2} 50% 75%, ${c3} 75% 100%)`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function queueGlyph(queue: string | undefined, size: number, stroke: number): string {
  const Icon = queueIcon(queue);
  return renderToStaticMarkup(<Icon size={size} color="var(--text-strong)" stroke={stroke} />);
}

function chip(edge: number, zIndex: number, content: string, extraStyle = ""): string {
  return `<div style="
      position:absolute;bottom:-${edge}px;right:-${edge}px;z-index:${zIndex};
      width:${SECONDARY_SIZE}px;height:${SECONDARY_SIZE}px;border-radius:9999px;
      display:flex;align-items:center;justify-content:center;
      background:var(--map-line);
      border:2px solid var(--map-bg);${extraStyle}
    ">${content}</div>`;
}

export interface SiteMarkerHtmlInput {
  queueCounts: QueueCount[];
  priorityPresence: PriorityPresence;
  selected: boolean;
  siteId?: string;
  /** Foto del sitio (ver siteImages.ts); null = sin foto, cae al ícono de la cola dominante. */
  imageUrl: string | null;
  /** Nombre visible del sitio; se muestra en una etiqueta sobre el marcador. */
  siteName?: string;
}

/**
 * HTML del marcador compuesto de un sitio (función pura, sin Leaflet, para
 * poder testearla en node):
 * - Centro: la FOTO del sitio dentro del aro segmentado de prioridad. Si el
 *   sitio no tiene foto, el centro muestra el ícono de la cola dominante
 *   (comportamiento previo).
 * - Insignia arriba a la izquierda: la cola raíz con más tickets abiertos
 *   (solo cuando hay foto — sin foto ya está en el centro, no se repite).
 * - Hasta 3 fichas secundarias abajo a la derecha para las siguientes
 *   colas con tickets abiertos; si sobran, el último slot es un badge "+N".
 */
export function buildSiteMarkerHtml({
  queueCounts,
  priorityPresence,
  selected,
  siteId,
  imageUrl,
  siteName,
}: SiteMarkerHtmlInput): string {
  const [dominant, ...additional] = queueCounts;

  const center = imageUrl
    ? `<img src="${escapeAttr(imageUrl)}" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:9999px;" />`
    : queueGlyph(dominant?.queue, Math.round(INNER_SIZE * 0.5), 2);

  const hasOpenTickets = priorityPresence.some(Boolean);
  // Sin tickets abiertos, computeSiteQueueBreakdown igual devuelve la cola
  // históricamente más frecuente (relleno para que el marcador sin foto no
  // quede vacío). Con foto ese relleno sobra: la insignia solo aparece si
  // hay tickets abiertos.
  const badgeHtml =
    imageUrl && dominant && hasOpenTickets
      ?`<div data-dominant-badge style="
          position:absolute;top:-${BADGE_OFFSET}px;left:-${BADGE_OFFSET}px;z-index:20;
          width:${BADGE_SIZE}px;height:${BADGE_SIZE}px;border-radius:9999px;
          display:flex;align-items:center;justify-content:center;
          background:var(--surface-1);
          border:2px solid var(--map-bg);
          box-shadow:0 1px 3px rgba(0,0,0,0.45);
        ">${queueGlyph(dominant.queue, Math.round(BADGE_SIZE * 0.6), 2.25)}</div>`
      : "";

  const selectedRing = selected ? "0 0 0 3px rgba(0,122,252,.6)," : "";
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
  const showOverflow = additional.length > MAX_SECONDARY_SLOTS;
  const iconsToShow = showOverflow
    ? additional.slice(0, MAX_SECONDARY_SLOTS - 1)
    : additional.slice(0, MAX_SECONDARY_SLOTS);
  const overflowCount = showOverflow ? additional.length - iconsToShow.length : 0;

  let secondaryHtml = "";
  iconsToShow.forEach((entry, index) => {
    secondaryHtml += chip(
      index * SECONDARY_STEP,
      10 + index,
      queueGlyph(entry.queue, Math.round(SECONDARY_SIZE * 0.6), 2.25)
    );
  });
  if (overflowCount > 0) {
    secondaryHtml += chip(
      iconsToShow.length * SECONDARY_STEP,
      10 + iconsToShow.length,
      `+${overflowCount}`,
      "font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:var(--text-strong);"
    );
  }

  // Etiqueta con el nombre, centrada sobre el aro (termina justo encima de la
  // insignia). Es la única pieza que puede salir del cuadrado de 90x90: el
  // nombre no cabe en él. pointer-events:none para no robar clics al mapa.
  const labelHtml = siteName
    ? `<div data-site-label style="
        position:absolute;left:${MAIN_CENTER}px;bottom:${WRAPPER_SIZE - LABEL_BOTTOM_Y}px;z-index:30;
        transform:translateX(-50%);white-space:nowrap;pointer-events:none;
        padding:2px 8px;border-radius:9999px;
        background:rgba(11,18,32,0.78);
        color:var(--text-strong);font-size:11px;font-weight:600;line-height:1.3;
        box-shadow:0 1px 3px rgba(0,0,0,0.45);
      ">${escapeAttr(siteName)}</div>`
    : "";

  // Punta del pin: triángulo con bordes CSS (no SVG: var() en atributos SVG falla en TV).
  const tailHtml = `<div data-pin-tail style="
      position:absolute;left:${MAIN_CENTER - TAIL_HALF_WIDTH}px;top:${TAIL_TOP}px;z-index:4;
      width:0;height:0;
      border-left:${TAIL_HALF_WIDTH}px solid transparent;
      border-right:${TAIL_HALF_WIDTH}px solid transparent;
      border-top:${TAIL_HEIGHT}px solid ${tailColor(priorityPresence)};
      filter:drop-shadow(0 2px 2px rgba(0,0,0,0.5));
    "></div>`;

  return `<div data-site-marker="${escapeAttr(siteId ?? "")}" data-secondary-count="${iconsToShow.length}" style="position:relative;width:${WRAPPER_SIZE}px;height:${WRAPPER_SIZE}px;transform:scale(var(--hud-zoom,1));transform-origin:${MAIN_CENTER}px ${MARKER_TIP_Y}px;">
      ${tailHtml}
      <div class="${pulseClass}" style="
        position:absolute;left:${MAIN_OFFSET}px;top:${MAIN_OFFSET}px;z-index:5;
        width:${MAIN_SIZE}px;height:${MAIN_SIZE}px;border-radius:9999px;
        background:${priorityRingBackground(priorityPresence)};
        box-shadow:${selectedRing} 0 0 0 2px rgba(11,18,32,0.7);
      ">
        <div style="
          position:absolute;left:${RING_WIDTH}px;top:${RING_WIDTH}px;
          width:${INNER_SIZE}px;height:${INNER_SIZE}px;border-radius:9999px;overflow:hidden;
          display:flex;align-items:center;justify-content:center;
          background:var(--surface-1);
        ">${center}</div>
        ${badgeHtml}
        ${secondaryHtml}
      </div>
      ${labelHtml}
    </div>`;
}
