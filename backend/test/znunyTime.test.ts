import { describe, it, expect } from "vitest";
import { znunyLocalToIso, epochToIsoOrNull, svDateKey } from "../src/znuny/time";

describe("znunyLocalToIso", () => {
  it("convierte hora de El Salvador (UTC-6) a ISO UTC", () => {
    expect(znunyLocalToIso("2026-11-05 14:24:47")).toBe("2026-11-05T20:24:47.000Z");
  });
  it("cruza el cambio de día", () => {
    expect(znunyLocalToIso("2026-11-05 19:30:00")).toBe("2026-11-06T01:30:00.000Z");
  });
});

describe("epochToIsoOrNull", () => {
  it("convierte un epoch Unix", () => {
    expect(epochToIsoOrNull(1794947087)).toBe("2026-11-17T20:24:47.000Z");
  });
  it("devuelve null para 0, '0' y null", () => {
    expect(epochToIsoOrNull(0)).toBeNull();
    expect(epochToIsoOrNull("0")).toBeNull();
    expect(epochToIsoOrNull(null)).toBeNull();
  });
});

describe("svDateKey", () => {
  it("devuelve el día calendario de El Salvador", () => {
    expect(svDateKey("2026-11-06T03:00:00.000Z")).toBe("2026-11-05");
  });
});
