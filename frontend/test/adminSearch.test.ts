import { describe, expect, it } from "vitest";
import { searchAdmin } from "../src/lib/adminSearch";
import { AdminUserSummary, Site } from "../src/types";

const user = (username: string): AdminUserSummary => ({
  username,
  email: `${username}@x.com`,
  role: "normal",
  allowedDepartments: [],
  allowedQueues: [],
  unknownQueues: [],
});
const site = (id: string, name: string): Site => ({ id, name, type: "sede", lat: 0, lng: 0, znunyKey: id });

describe("searchAdmin", () => {
  it("encuentra un sitio sin distinguir mayúsculas ni tildes", () => {
    const res = searchAdmin("santa", [], [site("santa-elena", "Santa Elena"), site("x", "Acajutla")]);
    expect(res).toEqual([{ kind: "site", id: "santa-elena", label: "Santa Elena" }]);
    expect(searchAdmin("ACAJÚTLA", [], [site("x", "Acajutla")])).toHaveLength(1);
  });

  it("encuentra un usuario por nombre de usuario", () => {
    const res = searchAdmin("rsan", [user("rsanchez"), user("jperez")], []);
    expect(res).toEqual([{ kind: "user", id: "rsanchez", label: "rsanchez" }]);
  });

  it("limita a 8 resultados", () => {
    const users = Array.from({ length: 20 }, (_, i) => user(`user${i}`));
    expect(searchAdmin("user", users, [])).toHaveLength(8);
  });

  it("consulta vacía no devuelve nada", () => {
    expect(searchAdmin("  ", [user("a")], [])).toEqual([]);
  });
});
