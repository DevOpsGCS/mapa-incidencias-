import "dotenv/config";
import { describe, it, expect } from "vitest";
import { getCatalog, getSiteOptions } from "../../src/znuny/catalogRepository";

describe("catálogo en vivo de Znuny", () => {
  it("topPriorityId es 6 (crítica)", async () => {
    expect((await getCatalog()).topPriorityId).toBe(6);
  });
  it("la cola Tecnología::Servicios IT tiene parent Tecnología", async () => {
    const q = (await getCatalog()).queues.find((x) => x.name === "Tecnología::Servicios IT");
    expect(q?.parent).toBe("Tecnología");
  });
  it("'espera de información' es de tipo open", async () => {
    const s = (await getCatalog()).states.find((x) => x.name === "espera de información");
    expect(s?.type).toBe("open");
  });
  it("getSiteOptions devuelve 14 entradas", async () => {
    expect(await getSiteOptions()).toHaveLength(14);
  });
});
