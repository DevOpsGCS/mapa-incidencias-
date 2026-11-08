import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.JWT_SECRET = "test-secret";

const m = vi.hoisted(() => ({
  users: {
    getQueueAccess: vi.fn(),
    getAllowedDepartments: vi.fn(),
    findAll: vi.fn(),
    findByUsername: vi.fn(),
    countAdmins: vi.fn(),
    updateProfile: vi.fn(),
    create: vi.fn(),
  },
  sites: {
    findAll: vi.fn(),
    findByZnunyKey: vi.fn(),
    upsertByZnunyKey: vi.fn(),
    remove: vi.fn(),
  },
  getCatalog: vi.fn(),
  getSiteOptions: vi.fn(),
  findAllTickets: vi.fn(),
  fetchLegacyTickets: vi.fn(),
  getLegacyMeta: vi.fn(),
  readOnlyQuery: vi.fn(),
}));

vi.mock("../src/repositories/usersRepository", () => ({ usersRepository: m.users }));
vi.mock("../src/repositories/sitesRepository", () => ({ sitesRepository: m.sites }));
vi.mock("../src/znuny/catalogRepository", () => ({
  getCatalog: m.getCatalog,
  getSiteOptions: m.getSiteOptions,
}));
vi.mock("../src/znuny/ticketsRepository", () => ({ findAllTickets: m.findAllTickets }));
vi.mock("../src/legacy/osticket/source", () => ({
  fetchLegacyTickets: m.fetchLegacyTickets,
  getLegacyMeta: m.getLegacyMeta,
}));
vi.mock("../src/legacy/osticket/db", () => ({ readOnlyQuery: m.readOnlyQuery }));

import { app } from "../src/index";
import { signSessionToken } from "../src/auth";
import { ZnunyUnavailableError } from "../src/znuny/db";

const cookie = (user: string, role: "admin" | "normal") => [
  `session_token=${signSessionToken(user, role)}`,
];
const catalog = {
  queues: [{ id: 1, name: "Soporte", parent: null, valid: true }],
  states: [],
  priorities: [],
  types: [],
  services: [],
  topPriorityId: 6,
};

beforeEach(() => {
  vi.resetAllMocks();
  m.getCatalog.mockResolvedValue(catalog);
  m.users.getAllowedDepartments.mockReturnValue(null);
});

describe("tickets y acceso", () => {
  it("sin cookie -> 401", async () => {
    expect((await request(app).get("/api/tickets")).status).toBe(401);
  });

  it("usuario sin allowedQueues -> [] y queueAccess none", async () => {
    m.users.getQueueAccess.mockReturnValue({ kind: "none" });
    m.findAllTickets.mockResolvedValue([]);
    const res = await request(app).get("/api/tickets").set("Cookie", cookie("ana", "normal"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    const me = await request(app).get("/api/me/access").set("Cookie", cookie("ana", "normal"));
    expect(me.body).toEqual({ queueAccess: "none" });
  });

  it("Znuny caído -> 503 en tickets, pero el histórico sigue en 200", async () => {
    m.users.getQueueAccess.mockReturnValue({ kind: "all" });
    m.findAllTickets.mockRejectedValue(new ZnunyUnavailableError());
    m.fetchLegacyTickets.mockResolvedValue([]);
    const c = cookie("ana", "normal");
    const res = await request(app).get("/api/tickets").set("Cookie", c);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Mesa de servicio no disponible" });
    const legacy = await request(app).get("/api/legacy/osticket/tickets").set("Cookie", c);
    expect(legacy.status).toBe(200);
  });
});

describe("sitios", () => {
  it("usa la etiqueta en vivo y cae al nombre guardado si Znuny está caído", async () => {
    m.sites.findAll.mockReturnValue([
      { id: "A", name: "Viejo", znunyKey: "K1", type: "sede", lat: 1, lng: 2 },
    ]);
    m.getSiteOptions.mockResolvedValue([{ key: "K1", label: "Nuevo" }]);
    const c = cookie("ana", "normal");
    expect((await request(app).get("/api/sites").set("Cookie", c)).body[0].name).toBe("Nuevo");
    m.getSiteOptions.mockRejectedValue(new ZnunyUnavailableError());
    const res = await request(app).get("/api/sites").set("Cookie", c);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Viejo");
  });
});

describe("admin", () => {
  const admin = cookie("root", "admin");

  it("POST /sites con znunyKey inexistente -> 400", async () => {
    m.getSiteOptions.mockResolvedValue([{ key: "K1", label: "Uno" }]);
    const res = await request(app)
      .post("/api/admin/sites")
      .set("Cookie", admin)
      .send({ znunyKey: "NoExiste", type: "sede", lat: 1, lng: 2 });
    expect(res.status).toBe(400);
    expect(m.sites.upsertByZnunyKey).not.toHaveBeenCalled();
  });

  it("unmapped devuelve opciones sin sitio", async () => {
    m.getSiteOptions.mockResolvedValue([
      { key: "K1", label: "Uno" },
      { key: "K2", label: "Dos" },
    ]);
    m.sites.findAll.mockReturnValue([{ znunyKey: "K1" }]);
    const res = await request(app).get("/api/admin/sites/unmapped").set("Cookie", admin);
    expect(res.body).toEqual([{ key: "K2", label: "Dos" }]);
  });

  it("PATCH profile con cola fantasma -> 400 mencionándola", async () => {
    const res = await request(app)
      .patch("/api/admin/users/ana/profile")
      .set("Cookie", admin)
      .send({ allowedQueues: ["Cola Fantasma"] });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("Cola Fantasma");
    expect(m.users.updateProfile).not.toHaveBeenCalled();
  });

  it("GET /users marca unknownQueues", async () => {
    m.users.findAll.mockReturnValue([
      { username: "ana", email: "", role: "normal", allowedDepartments: [], allowedQueues: ["Vieja", "Soporte"] },
      { username: "bob", email: "", role: "normal", allowedDepartments: [], allowedQueues: null },
    ]);
    const res = await request(app).get("/api/admin/users").set("Cookie", admin);
    expect(res.body[0].unknownQueues).toEqual(["Vieja"]);
    expect(res.body[1].unknownQueues).toEqual([]);
  });

  it("/departments responde 503 si osTicket está caído", async () => {
    m.readOnlyQuery.mockRejectedValue(Object.assign(new Error("x"), { code: "ECONNREFUSED" }));
    const res = await request(app).get("/api/admin/departments").set("Cookie", admin);
    expect(res.status).toBe(503);
  });
});
