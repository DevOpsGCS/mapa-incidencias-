import { describe, it, expect } from "vitest";
import { selectChanged, parseStateUpdate, removalRooms } from "../src/sockets/pollerLogic";

describe("selectChanged", () => {
  const rows = [
    { id: 1, changeTimeRaw: "2026-11-08 10:00:00" },
    { id: 2, changeTimeRaw: "2026-11-08 10:00:05" },
  ];

  it("emite solo lo no visto y avanza la marca de agua", () => {
    const r = selectChanged(rows, "2026-11-08 10:00:00", new Set(["1|2026-11-08 10:00:00"]));
    expect(r.ids).toEqual([2]);
    expect(r.watermark).toBe("2026-11-08 10:00:05");
    expect(r.seen).toEqual(new Set(["2|2026-11-08 10:00:05"]));
  });

  it("no duplica al aplicar la misma entrada con el estado de salida", () => {
    const first = selectChanged(rows, "2026-11-08 10:00:00", new Set(["1|2026-11-08 10:00:00"]));
    const second = selectChanged(rows, first.watermark, first.seen);
    expect(second.ids).toEqual([]);
    expect(second.watermark).toBe("2026-11-08 10:00:05");
  });

  it("dos tickets en el mismo segundo que la marca: solo el no visto", () => {
    const same = [
      { id: 1, changeTimeRaw: "2026-11-08 10:00:00" },
      { id: 3, changeTimeRaw: "2026-11-08 10:00:00" },
    ];
    const r = selectChanged(same, "2026-11-08 10:00:00", new Set(["1|2026-11-08 10:00:00"]));
    expect(r.ids).toEqual([3]);
    expect(r.seen).toEqual(new Set(["1|2026-11-08 10:00:00", "3|2026-11-08 10:00:00"]));
  });
});

describe("parseStateUpdate", () => {
  it("parsea estados", () => {
    expect(parseStateUpdate("%%nuevo%%abierto%%")).toEqual({ from: "nuevo", to: "abierto" });
    expect(parseStateUpdate("%%abierto%%espera de información%%")).toEqual({
      from: "abierto",
      to: "espera de información",
    });
  });
  it("devuelve null con texto raro", () => {
    expect(parseStateUpdate("texto raro")).toBeNull();
  });
});

describe("removalRooms", () => {
  it("solo las rooms de la cola vieja que la nueva ya no cubre", () => {
    expect(removalRooms("Tecnología::Servicios IT", "Tecnología::Back Office")).toEqual([
      "queue:Tecnología::Servicios IT",
    ]);
    expect(removalRooms("CCTV", "Tecnología")).toEqual(["queue:CCTV"]);
  });
  it("nunca incluye all-queues", () => {
    expect(removalRooms("A", "B")).not.toContain("all-queues");
  });
});
