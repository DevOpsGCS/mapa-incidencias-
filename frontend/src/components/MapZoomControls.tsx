import { useEffect, useRef } from "react";
import L, { LatLngBoundsExpression } from "leaflet";
import { useMap } from "react-leaflet";
import { countryFitOptions } from "../lib/mapFraming";
import { Crosshair, Minus, Plus } from "lucide-react";

interface MapZoomControlsProps {
  homeBounds: LatLngBoundsExpression;
}

// Teclas que mandan los controles remotos de TV (Android TV / Google TV) y
// teclados. Sin rueda de mouse ni pinch, esta es la única forma de hacer
// zoom en esos navegadores.
const ZOOM_IN_KEYS = new Set(["+", "=", "Add", "PageUp", "ChannelUp", "MediaTrackNext"]);
const ZOOM_OUT_KEYS = new Set(["-", "_", "Subtract", "PageDown", "ChannelDown", "MediaTrackPrevious"]);

const BUTTON_CLASS =
  "flex h-12 w-12 items-center justify-center text-text transition-colors hover:bg-surface-2 hover:text-text-strong focus-visible:bg-surface-2 focus-visible:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-text)]";

export function MapZoomControls({ homeBounds }: MapZoomControlsProps) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);

  // Los botones viven dentro del contenedor de Leaflet: sin esto, un clic
  // rápido en "+" se interpreta además como doble clic/arrastre del mapa.
  useEffect(() => {
    if (!containerRef.current) return;
    L.DomEvent.disableClickPropagation(containerRef.current);
    L.DomEvent.disableScrollPropagation(containerRef.current);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      // Con el mapa enfocado, el handler de teclado propio de Leaflet ya
      // procesa +/- y flechas; no duplicar el zoom.
      if (target && map.getContainer().contains(target) && (event.key === "+" || event.key === "-")) return;

      if (ZOOM_IN_KEYS.has(event.key)) {
        event.preventDefault();
        map.zoomIn();
      } else if (ZOOM_OUT_KEYS.has(event.key)) {
        event.preventDefault();
        map.zoomOut();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [map]);

  return (
    <div
      ref={containerRef}
      className="hud-scale absolute right-[312px] top-[78px] z-[1000] flex flex-col overflow-hidden rounded-panel glass"
    >
      <button type="button" aria-label="Acercar" className={BUTTON_CLASS} onClick={() => map.zoomIn()}>
        <Plus size={22} />
      </button>
      <button
        type="button"
        aria-label="Alejar"
        className={`${BUTTON_CLASS} border-y border-line`}
        onClick={() => map.zoomOut()}
      >
        <Minus size={22} />
      </button>
      <button
        type="button"
        aria-label="Recentrar mapa"
        className={BUTTON_CLASS}
        onClick={() => map.fitBounds(homeBounds, countryFitOptions())}
      >
        <Crosshair size={20} />
      </button>
    </div>
  );
}
