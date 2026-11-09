import { describe, expect, it } from "vitest";
import { siteImageUrl } from "../src/lib/siteImages";
import { buildSiteMarkerHtml } from "../src/lib/siteMarkerHtml";
import { EMPTY_PRESENCE, PriorityPresence } from "../src/lib/siteDominance";

describe("siteImageUrl", () => {
  it("resuelve la foto por la clave de Ubicacion de Znuny", () => {
    expect(siteImageUrl("Poy")).toBe("/sites/poy.webp");
    expect(siteImageUrl("Santa Elena")).toBe("/sites/santa-elena.webp");
    expect(siteImageUrl("Aeropuerto Terminal de Carga")).toBe("/sites/aeropuerto-terminal-de-carga.webp");
  });

  it("tolera tildes y mayúsculas en la clave", () => {
    expect(siteImageUrl("Anguiatú")).toBe("/sites/anguiatu.webp");
    expect(siteImageUrl("san cristobal")).toBe("/sites/san-cristobal.webp");
  });

  it("devuelve null si el sitio no tiene foto o no tiene clave", () => {
    expect(siteImageUrl("Oficina Diaspora")).toBeNull();
    expect(siteImageUrl(null)).toBeNull();
    expect(siteImageUrl(undefined)).toBeNull();
    expect(siteImageUrl("")).toBeNull();
  });
});

const TOP_OPEN: PriorityPresence = [true, false, false, false];

describe("buildSiteMarkerHtml", () => {
  it("con foto: la foto llena el centro y la cola dominante va en la insignia", () => {
    const html = buildSiteMarkerHtml({
      queueCounts: [
        { queue: "Tecnología", count: 3 },
        { queue: "CCTV", count: 1 },
      ],
      priorityPresence: TOP_OPEN,
      selected: false,
      siteId: "El Poy",
      imageUrl: "/sites/poy.webp",
    });
    expect(html).toContain('src="/sites/poy.webp"');
    expect(html).toContain("data-dominant-badge");
    expect(html).toContain('data-secondary-count="1"');
    expect(html).toContain("marker-pulse");
  });

  it("con foto y sin tickets abiertos: sin insignia ni fichas", () => {
    const html = buildSiteMarkerHtml({
      queueCounts: [],
      priorityPresence: EMPTY_PRESENCE,
      selected: false,
      siteId: "El Poy",
      imageUrl: "/sites/poy.webp",
    });
    expect(html).toContain('src="/sites/poy.webp"');
    expect(html).not.toContain("data-dominant-badge");
    expect(html).toContain('data-secondary-count="0"');
  });

  it("con foto y solo la cola histórica de relleno (sin abiertos): sin insignia", () => {
    const html = buildSiteMarkerHtml({
      queueCounts: [{ queue: "Tecnología", count: 5 }],
      priorityPresence: EMPTY_PRESENCE,
      selected: false,
      siteId: "Hachadura",
      imageUrl: "/sites/hachadura.webp",
    });
    expect(html).not.toContain("data-dominant-badge");
  });

  it("sin foto: el centro muestra el ícono de la cola dominante y no repite la insignia", () => {
    const html = buildSiteMarkerHtml({
      queueCounts: [{ queue: "Tecnología", count: 2 }],
      priorityPresence: TOP_OPEN,
      selected: false,
      siteId: "Oficina de la Diaspora",
      imageUrl: null,
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("data-dominant-badge");
    expect(html).toContain("<svg");
  });

  it("escapa la URL de la imagen", () => {
    const html = buildSiteMarkerHtml({
      queueCounts: [],
      priorityPresence: EMPTY_PRESENCE,
      selected: false,
      siteId: "x",
      imageUrl: '/sites/a"b.webp',
    });
    expect(html).toContain('src="/sites/a&quot;b.webp"');
  });
});
