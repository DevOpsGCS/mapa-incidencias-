import { describe, expect, it } from "vitest";
import { PANEL_BOTTOM_OFFSET, TOPBAR_OFFSET, formatAge, panelHeights, pickSelected, queueLabel } from "../src/lib/sitePanel";
import { Ticket } from "../src/types";

const NOW = new Date("2026-11-09T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const t = (id: number) => ({ id }) as Ticket;

describe("formatAge", () => {
  it("minutos", () => expect(formatAge(ago(5 * 60_000), NOW)).toBe("hace 5 min"));
  it("horas", () => expect(formatAge(ago(3 * 3_600_000), NOW)).toBe("hace 3 h"));
  it("días", () => expect(formatAge(ago(2 * 86_400_000), NOW)).toBe("hace 2 d"));
  it("futuro o menos de un minuto = hace 0 min", () => {
    expect(formatAge(ago(-5000), NOW)).toBe("hace 0 min");
  });
});

describe("queueLabel", () => {
  it("reemplaza :: por ›", () => {
    expect(queueLabel("Tecnología::Servicios IT")).toBe("Tecnología › Servicios IT");
  });
  it("sin subcola queda igual", () => expect(queueLabel("Raw")).toBe("Raw"));
});

describe("pickSelected", () => {
  it("conserva la selección si está visible", () => {
    expect(pickSelected([t(1), t(2)], 2)?.id).toBe(2);
  });
  it("cae al primero si la selección no está visible o es null", () => {
    expect(pickSelected([t(1), t(2)], 9)?.id).toBe(1);
    expect(pickSelected([t(1), t(2)], null)?.id).toBe(1);
  });
  it("lista vacía devuelve null (nunca el ticket del filtro anterior)", () => {
    expect(pickSelected([], 1)).toBeNull();
  });
});

describe("pickSelected prefiere abiertos", () => {
  const closed = (id: number) => ({ id, stateType: "closed" }) as Ticket;
  const open = (id: number) => ({ id, stateType: "open" }) as Ticket;
  it("sin selección elige el primer ticket abierto", () => {
    expect(pickSelected([closed(1), open(2), open(3)], null)?.id).toBe(2);
  });
  it("si no hay abiertos, el primero", () => {
    expect(pickSelected([closed(1), closed(2)], null)?.id).toBe(1);
  });
  it("la selección visible gana aunque esté cerrada", () => {
    expect(pickSelected([open(1), closed(2)], 2)?.id).toBe(2);
  });
});

describe("panelHeights", () => {
  it.each([
    [1440, 0.75],
    [1080, 1],
    [1440, 1.333],
  ])("expandida entra en pantalla (innerHeight %i, zoom %f)", (innerHeight, zoom) => {
    const { compact, expanded } = panelHeights({ innerHeight, zoom, kpiBottomPx: null });
    // En pantalla = local * zoom; debe caber bajo la barra superior y sobre el borde inferior.
    expect(expanded * zoom).toBeCloseTo(innerHeight - (TOPBAR_OFFSET + PANEL_BOTTOM_OFFSET) * zoom, 5);
    expect(expanded * zoom + (TOPBAR_OFFSET + PANEL_BOTTOM_OFFSET) * zoom).toBeLessThanOrEqual(innerHeight + 1e-6);
    expect(compact).toBeLessThanOrEqual(Math.max(200, expanded));
  });
  it("zoom 1 sin dock: valores conocidos", () => {
    const r = panelHeights({ innerHeight: 1000, zoom: 1, kpiBottomPx: null });
    expect(r.expanded).toBe(1000 - 78 - 20);
    expect(r.compact).toBe(Math.max(200, Math.min(380, Math.floor(1000 - 520 - 20 - 12))));
  });
  it("el borde del dock en px de pantalla se convierte a locales", () => {
    const r = panelHeights({ innerHeight: 1440, zoom: 1.333, kpiBottomPx: 800 });
    const viewport = 1440 / 1.333;
    expect(r.compact).toBe(Math.max(200, Math.min(Math.round(viewport * 0.38), Math.floor(viewport - 800 / 1.333 - 20 - 12))));
  });
});
