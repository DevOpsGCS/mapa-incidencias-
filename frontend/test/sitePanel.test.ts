import { describe, expect, it } from "vitest";
import { formatAge, pickSelected, queueLabel } from "../src/lib/sitePanel";
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
