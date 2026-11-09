import { describe, expect, it } from "vitest";
import { matchesSearch } from "../src/lib/ticketSearch";
import { Ticket } from "../src/types";

const t = { tn: "202611066600012", title: "No puedo imprimir… Impresión" } as Ticket;

describe("matchesSearch", () => {
  it("ignora tildes y mayúsculas en el título", () => expect(matchesSearch(t, "impresion")).toBe(true));
  it("encuentra el tn de forma parcial", () => expect(matchesSearch(t, "600012")).toBe(true));
  it("texto vacío devuelve true", () => {
    expect(matchesSearch(t, "")).toBe(true);
    expect(matchesSearch(t, "   ")).toBe(true);
  });
  it("sin coincidencia devuelve false", () => expect(matchesSearch(t, "zzz")).toBe(false));
});
