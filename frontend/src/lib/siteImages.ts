// Foto de cada sitio para el marcador del mapa, por la CLAVE de `Ubicacion`
// en Znuny (Site.znunyKey), nunca por nombre visible ni id: el nombre lo
// maneja Znuny y puede cambiar. Las fotos vienen del proyecto MapaSensores,
// reducidas a miniaturas WebP de 160x160 (~5 KB c/u) para no cargar las TVs.
// Un sitio sin foto (hoy "Oficina Diaspora") cae al ícono de la cola
// dominante en el centro del marcador — nunca se rompe.
//
// Para agregar una foto: guardar `public/sites/<slug>.webp` (slug = clave
// en minúsculas, sin tildes, espacios → "-") y sumar el slug acá.
const AVAILABLE_SLUGS = new Set([
  "acajutla",
  "aeropuerto-internacional",
  "aeropuerto-terminal-de-carga",
  "aeropuerto-terminal-de-pasajeros",
  "amatillo",
  "anguiatu",
  "chinamas",
  "hachadura",
  "poy",
  "san-bartolo",
  "san-cristobal",
  "san-francisco",
  "santa-elena",
]);

function slugify(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function siteImageUrl(znunyKey: string | null | undefined): string | null {
  if (!znunyKey) return null;
  const slug = slugify(znunyKey);
  return AVAILABLE_SLUGS.has(slug) ? `/sites/${slug}.webp` : null;
}
