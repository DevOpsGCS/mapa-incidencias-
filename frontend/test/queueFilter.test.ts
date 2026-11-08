import { describe, expect, it } from "vitest";
import { matchesQueueFilter } from "../src/lib/queueFilter";

describe("matchesQueueFilter", () => {
  it("coincide con la cola exacta y con sus subcolas", () => {
    expect(matchesQueueFilter("Tecnología", "Tecnología")).toBe(true);
    expect(matchesQueueFilter("Tecnología::Back Office", "Tecnología")).toBe(true);
    expect(matchesQueueFilter("Tecnología::Back Office::Redes", "Tecnología::Back Office")).toBe(true);
  });

  it("no coincide con colas que solo comparten prefijo de texto", () => {
    expect(matchesQueueFilter("TecnologíaX", "Tecnología")).toBe(false);
    expect(matchesQueueFilter("Tecnología", "Tecnología::Back Office")).toBe(false);
  });

  it("sin selección (null) coincide con cualquiera", () => {
    expect(matchesQueueFilter("CCTV", null)).toBe(true);
    expect(matchesQueueFilter("", null)).toBe(true);
  });
});
