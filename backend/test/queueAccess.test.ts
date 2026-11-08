import { describe, it, expect } from "vitest";
import {
  accessFromAllowedQueues,
  toSqlCondition,
  queueAncestors,
  roomsForTicketQueue,
  roomsForAccess,
  canSeeQueue,
} from "../src/znuny/queueAccess";

describe("accessFromAllowedQueues", () => {
  it("undefined = sin acceso", () => {
    expect(accessFromAllowedQueues(undefined)).toEqual({ kind: "none" });
  });
  it("[] = todo", () => {
    expect(accessFromAllowedQueues([])).toEqual({ kind: "all" });
  });
  it("lista = esas colas", () => {
    expect(accessFromAllowedQueues(["CCTV"])).toEqual({ kind: "some", queues: ["CCTV"] });
  });
});

describe("toSqlCondition", () => {
  it("all", () => {
    expect(toSqlCondition({ kind: "all" }, "q.name")).toEqual({ sql: "1=1", params: [] });
  });
  it("none", () => {
    expect(toSqlCondition({ kind: "none" }, "q.name")).toEqual({ sql: "1=0", params: [] });
  });
  it("some", () => {
    expect(toSqlCondition({ kind: "some", queues: ["Tecnología", "CCTV"] }, "q.name")).toEqual({
      sql: "((q.name = ? OR q.name LIKE ?) OR (q.name = ? OR q.name LIKE ?))",
      params: ["Tecnología", "Tecnología::%", "CCTV", "CCTV::%"],
    });
  });
  it("escapa los comodines de LIKE", () => {
    expect(toSqlCondition({ kind: "some", queues: ["A_B%"] }, "q.name").params).toEqual([
      "A_B%",
      "A\\_B\\%::%",
    ]);
  });
});

describe("queueAncestors", () => {
  it("devuelve la cola y sus ancestros", () => {
    expect(queueAncestors("A::B::C")).toEqual(["A", "A::B", "A::B::C"]);
  });
});

describe("rooms", () => {
  it("roomsForTicketQueue", () => {
    expect(roomsForTicketQueue("Tecnología::Servicios IT")).toEqual([
      "all-queues",
      "queue:Tecnología",
      "queue:Tecnología::Servicios IT",
    ]);
  });
  it("roomsForAccess", () => {
    expect(roomsForAccess({ kind: "some", queues: ["CCTV"] })).toEqual(["queue:CCTV"]);
    expect(roomsForAccess({ kind: "all" })).toEqual(["all-queues"]);
    expect(roomsForAccess({ kind: "none" })).toEqual([]);
  });
});

describe("canSeeQueue", () => {
  const some = (...queues: string[]) => ({ kind: "some" as const, queues });
  it("ve las subcolas", () => {
    expect(canSeeQueue(some("Tecnología"), "Tecnología::Back Office")).toBe(true);
  });
  it("no confunde prefijos", () => {
    expect(canSeeQueue(some("Tecnología"), "TecnologíaX")).toBe(false);
  });
  it("no ve la cola padre", () => {
    expect(canSeeQueue(some("Tecnología::Redes y Ciberseguridad"), "Tecnología")).toBe(false);
  });
  it("all / none", () => {
    expect(canSeeQueue({ kind: "all" }, "X")).toBe(true);
    expect(canSeeQueue({ kind: "none" }, "X")).toBe(false);
  });
});
