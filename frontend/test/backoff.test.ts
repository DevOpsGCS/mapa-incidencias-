import { describe, expect, it } from "vitest";
import { nextBackoffMs } from "../src/lib/backoff";

describe("nextBackoffMs", () => {
  it("duplica desde 5 s hasta el tope de 60 s", () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(nextBackoffMs)).toEqual([5000, 10000, 20000, 40000, 60000, 60000, 60000]);
  });

  it("un intento negativo cuenta como el primero", () => {
    expect(nextBackoffMs(-1)).toBe(5000);
  });
});
