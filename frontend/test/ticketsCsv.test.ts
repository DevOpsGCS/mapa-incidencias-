import { describe, expect, it } from "vitest";
import { COLUMN_LABELS } from "../src/lib/tableColumns";
import { csvFileName, ticketsToCsv } from "../src/lib/ticketsCsv";
import { Ticket } from "../src/types";

const ctx = { siteName: () => "Aeropuerto", priorityName: (t: Ticket) => t.priority };
const base = {
  id: 1,
  tn: "2026110001",
  title: 'Pedido "urgente", sala 2\nsegundo',
  queue: "Tecnología::Servicios",
  state: "Abierto",
  priority: "Crítica",
  owner: "Ana Peña",
  createdAt: "2026-11-09T18:05:00Z",
} as Ticket;

describe("ticketsToCsv", () => {
  const csv = ticketsToCsv([base], ["tn", "title", "created"], ctx);

  it("empieza con BOM y usa CRLF", () => {
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n").length).toBe(2);
  });
  it("encabezado con COLUMN_LABELS en el orden pedido", () => {
    const header = csv.slice(1).split("\r\n")[0];
    expect(header).toBe(["tn", "title", "created"].map((c) => COLUMN_LABELS[c as keyof typeof COLUMN_LABELS]).join(","));
  });
  it("escapa comillas, comas y saltos de línea (RFC 4180)", () => {
    expect(csv).toContain('"Pedido ""urgente"", sala 2\nsegundo"');
  });
  it("conserva las tildes", () => {
    const c = ticketsToCsv([base], ["owner", "priority"], ctx);
    expect(c).toContain("Ana Peña");
    expect(c).toContain("Crítica");
  });
  it("fecha dd/mm/aaaa HH:mm en hora de El Salvador", () => {
    expect(csv).toContain("09/11/2026 12:05");
  });
  it("solo salen las columnas pedidas", () => {
    const c = ticketsToCsv([base], ["tn"], ctx);
    expect(c).toBe("\uFEFF" + COLUMN_LABELS.tn + "\r\n2026110001");
  });
});

describe("csvFileName", () => {
  it("usa hora de El Salvador", () => {
    expect(csvFileName(new Date("2026-11-09T18:05:00Z"))).toBe("tickets-20261109-1205.csv");
  });
});

describe("neutralización de fórmulas", () => {
  it.each(["=1+1", "+SUM(A1)", "-2", "@cmd", "\tx", "\rx"])("prefija ' a %j", (v) => {
    const c = ticketsToCsv([{ ...base, title: v }], ["title"], ctx);
    expect(c.slice(1).split("\r\n")[1].replace(/^"|"$/g, "")).toBe("'" + v);
  });
  it("no toca valores normales ni el Nº", () => {
    const c = ticketsToCsv([{ ...base, title: "Hola -x" }], ["tn", "title"], ctx);
    expect(c).toContain("2026110001,Hola -x");
  });
});
