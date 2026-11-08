import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { migrateUsersV2 } from "../src/migrations/usersV2";
import { migrateSitesV2 } from "../src/migrations/sitesV2";

const baseUser = {
  email: "a@b.c",
  passwordHash: "x",
  role: "normal" as const,
  resetToken: null,
  resetTokenExpiry: null,
};

describe("migrateUsersV2", () => {
  it("allowedDepartments vacío -> allowedQueues []; con lista -> sin la clave", () => {
    const { changed, file } = migrateUsersV2({
      users: [
        { ...baseUser, username: "libre", allowedDepartments: [] },
        { ...baseUser, username: "cctv", allowedDepartments: ["CCTV"] },
      ],
    });
    expect(changed).toBe(true);
    expect(file.schemaVersion).toBe(2);
    expect(file.users[0].allowedQueues).toEqual([]);
    expect("allowedQueues" in file.users[1]).toBe(false);
  });

  it("es idempotente y no convierte un usuario nuevo en []", () => {
    const first = migrateUsersV2({
      users: [{ ...baseUser, username: "libre", allowedDepartments: [] }],
    });
    const withNew = {
      ...first.file,
      users: [...first.file.users, { ...baseUser, username: "nuevo", allowedDepartments: [] }],
    };
    const second = migrateUsersV2(withNew);
    expect(second.changed).toBe(false);
    expect("allowedQueues" in second.file.users[1]).toBe(false);
  });
});

describe("migrateSitesV2", () => {
  const site = (name: string) => ({ name, type: "aduana_terrestre", lat: 1, lng: 2 });

  it("asigna znunyKey por override, coincidencia normalizada y marca legacyOnly", () => {
    const { changed, file } = migrateSitesV2({
      sites: [site("El Poy"), site("Anguiatú"), site("Acajutla"), site("Fardos Postales")],
    });
    expect(changed).toBe(true);
    expect(file.schemaVersion).toBe(2);
    expect(file.sites[0].znunyKey).toBe("Poy");
    expect(file.sites[1].znunyKey).toBe("Anguiatu");
    expect(file.sites[2].znunyKey).toBe("Acajutla");
    expect(file.sites[3].legacyOnly).toBe(true);
    expect(file.sites[3].znunyKey).toBeUndefined();
    expect(migrateSitesV2(file).changed).toBe(false);
  });
});

describe("repositorios con DATA_DIR temporal", () => {
  let dir: string;
  const prevEnv = process.env.DATA_DIR;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "migr-"));
    process.env.DATA_DIR = dir;
    vi.resetModules();
  });
  afterEach(() => {
    if (prevEnv === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prevEnv;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const user = (username: string, allowedDepartments: string[]) => ({
    username,
    email: `${username}@x.com`,
    passwordHash: "h",
    role: "normal",
    resetToken: null,
    resetTokenExpiry: null,
    allowedDepartments,
  });
  const baks = (prefix: string) => fs.readdirSync(dir).filter((f) => f.startsWith(`${prefix}.bak-`));
  const writeSites = (obj: unknown) =>
    fs.writeFileSync(path.join(dir, "site-metadata.json"), JSON.stringify(obj));
  const writeUsers = (obj: unknown) =>
    fs.writeFileSync(path.join(dir, "users.json"), JSON.stringify(obj));

  it("usuarios: escribe .bak-YYYYMMDD y la migración antes de guardar", async () => {
    writeUsers({ users: [user("libre", []), user("cctv", ["CCTV"])] });
    const { usersRepository } = await import("../src/repositories/usersRepository");
    const files = baks("users.json");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^users\.json\.bak-\d{8}$/);
    const backup = JSON.parse(fs.readFileSync(path.join(dir, files[0]), "utf-8"));
    expect(backup.schemaVersion).toBeUndefined();
    const saved = JSON.parse(fs.readFileSync(path.join(dir, "users.json"), "utf-8"));
    expect(saved.schemaVersion).toBe(2);
    expect(usersRepository.getQueueAccess("libre")).toEqual({ kind: "all" });
    expect(usersRepository.getQueueAccess("cctv")).toEqual({ kind: "none" });
  });

  it("usuarios: no crea .bak si no hay cambios", async () => {
    writeUsers({ schemaVersion: 2, users: [user("libre", [])] });
    await import("../src/repositories/usersRepository");
    expect(baks("users.json")).toHaveLength(0);
  });

  it("usuario nuevo sin allowedQueues sigue sin acceso tras reconstruir el repositorio", async () => {
    writeUsers({ users: [user("libre", [])] });
    let mod = await import("../src/repositories/usersRepository");
    const created = await mod.usersRepository.create({
      username: "nuevo",
      email: "n@x.com",
      password: "secreto",
      role: "normal",
    });
    expect(created.ok).toBe(true);
    vi.resetModules();
    mod = await import("../src/repositories/usersRepository");
    expect(mod.usersRepository.getQueueAccess("nuevo")).toEqual({ kind: "none" });
    expect(mod.usersRepository.getQueueAccess("libre")).toEqual({ kind: "all" });
    expect(mod.usersRepository.findAll().find((u) => u.username === "nuevo")?.allowedQueues).toBeNull();
  });

  it("updateProfile: allowedQueues null borra el campo", async () => {
    writeUsers({ schemaVersion: 2, users: [{ ...user("a", []), allowedQueues: ["X"] }] });
    const { usersRepository } = await import("../src/repositories/usersRepository");
    usersRepository.updateProfile("a", { allowedQueues: null });
    expect(usersRepository.getQueueAccess("a")).toEqual({ kind: "none" });
  });

  it("sitios: migra con .bak, findAll excluye legacyOnly y findByZnunyKey/upsert funcionan", async () => {
    writeSites({
      sites: [
        { name: "El Poy", type: "aduana_terrestre", lat: 1, lng: 2 },
        { name: "Fardos Postales", type: "sede", lat: 3, lng: 4 },
      ],
    });
    const { sitesRepository } = await import("../src/repositories/sitesRepository");
    expect(baks("site-metadata.json")).toHaveLength(1);
    expect(sitesRepository.findAll().map((s) => s.name)).toEqual(["El Poy"]);
    expect(sitesRepository.findByZnunyKey("Poy")?.id).toBe("El Poy");
    expect(sitesRepository.findByZnunyKey("Nada")).toBeUndefined();
    const created = sitesRepository.upsertByZnunyKey({
      znunyKey: "Acajutla",
      type: "aduana_maritima",
      lat: 5,
      lng: 6,
    });
    expect(created.znunyKey).toBe("Acajutla");
    const saved = JSON.parse(fs.readFileSync(path.join(dir, "site-metadata.json"), "utf-8"));
    expect(saved.schemaVersion).toBe(2);
  });

  it("sitios: upsert legacy de un sitio migrado conserva znunyKey y legacyOnly", async () => {
    writeSites({
      sites: [
        { name: "El Poy", type: "aduana_terrestre", lat: 1, lng: 2 },
        { name: "Fardos Postales", type: "sede", lat: 3, lng: 4 },
      ],
    });
    const { sitesRepository } = await import("../src/repositories/sitesRepository");
    sitesRepository.upsert({ name: "el poy", type: "sede", lat: 9, lng: 8 });
    sitesRepository.upsert({ name: "Fardos Postales", type: "sede", lat: 7, lng: 6 });
    const saved = JSON.parse(fs.readFileSync(path.join(dir, "site-metadata.json"), "utf-8"));
    expect(saved.schemaVersion).toBe(2);
    expect(saved.sites[0]).toMatchObject({ name: "El Poy", znunyKey: "Poy", type: "sede", lat: 9, lng: 8 });
    expect(saved.sites[1]).toMatchObject({ name: "Fardos Postales", legacyOnly: true, lat: 7, lng: 6 });
    expect(sitesRepository.findAll().map((x) => x.name)).toEqual(["El Poy"]);
  });

  it("sitios: no crea .bak si no hay cambios", async () => {
    writeSites({ schemaVersion: 2, sites: [] });
    await import("../src/repositories/sitesRepository");
    expect(baks("site-metadata.json")).toHaveLength(0);
  });
});
