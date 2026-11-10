import mapBackdrop from "../assets/map-backdrop.webp";

/**
 * Fondo de las pantallas sin mapa en vivo (login, Métricas, Histórico y
 * administración): una captura ESTÁTICA del mapa (solo mosaicos, contorno y
 * fotos de los sitios, sin paneles ni datos de tickets), desenfocada, con un
 * velo oscuro y el resplandor de `.app-backdrop` encima. Es estática a
 * propósito: en el login no hay sesión (no se pueden pedir datos) y en las
 * demás vistas evita montar un segundo Leaflet (caro en navegadores de TV).
 *
 * Va como primer hijo de un contenedor con `isolation: isolate` (clase
 * `isolate`): el `-z-10` lo deja detrás del contenido pero sobre el fondo del
 * contenedor. Si el mapa cambia mucho de diseño, regenerar la captura
 * (`src/assets/map-backdrop.webp`, 1280×720).
 */
export function MapBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${mapBackdrop})`, filter: "blur(7px)", transform: "scale(1.08)" }}
      />
      <div className="absolute inset-0 bg-bg" style={{ opacity: 0.55 }} />
      <div className="app-backdrop absolute inset-0" />
    </div>
  );
}
