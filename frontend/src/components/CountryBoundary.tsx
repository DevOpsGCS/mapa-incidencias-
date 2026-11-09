import { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";
import type { PathOptions } from "leaflet";
import { MAP_BOUNDARY_HEX } from "../lib/dataColors";

const BOUNDARY_URL = "/data/el-salvador-boundary.geojson";

// Trazo fino y sutil: solo delinea el país, sin relleno, para que no
// compita visualmente con los marcadores de sitios ni con las etiquetas
// del mapa base.
const BOUNDARY_STYLE: PathOptions = {
  color: MAP_BOUNDARY_HEX,
  weight: 1.2,
  fillOpacity: 0,
  opacity: 0.9,
};

/**
 * Contorno nacional de El Salvador (ADM0, geoBoundaries). Se renderiza en
 * el "overlayPane" de Leaflet (z-index 400 por defecto), que ya queda por
 * debajo del "markerPane" (600) donde viven los marcadores de sitios — no
 * hace falta forzar z-order a mano. `interactive={false}` para que no
 * intercepte clics/hover que deberían llegar al mapa o a los marcadores.
 */
export function CountryBoundary() {
  const [boundary, setBoundary] = useState<GeoJSON.GeoJsonObject | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(BOUNDARY_URL)
      .then((response) => response.json())
      .then((data: GeoJSON.GeoJsonObject) => {
        if (!cancelled) setBoundary(data);
      })
      .catch((error) => {
        console.error("No se pudo cargar el contorno de El Salvador:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!boundary) return null;

  return <GeoJSON data={boundary} style={() => BOUNDARY_STYLE} interactive={false} />;
}
