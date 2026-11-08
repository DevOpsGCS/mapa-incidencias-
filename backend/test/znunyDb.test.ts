import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const createPoolMock = vi.fn(() => ({ query: queryMock }));
vi.mock("mysql2/promise", () => ({ default: { createPool: createPoolMock } }));

const savedEnv = { ...process.env };

async function loadDb() {
  vi.resetModules(); // pool nuevo en cada test
  return import("../src/znuny/db");
}

beforeEach(() => {
  queryMock.mockReset();
  createPoolMock.mockClear();
  process.env.ZNUNY_DB_HOST = "127.0.0.1";
});
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("znunyReadOnlyQuery", () => {
  it.each(["ENOTFOUND", "EHOSTUNREACH", "ECONNREFUSED"])("%s -> ZnunyUnavailableError", async (code) => {
    const { znunyReadOnlyQuery, ZnunyUnavailableError } = await loadDb();
    queryMock.mockRejectedValue(Object.assign(new Error("x"), { code }));
    await expect(znunyReadOnlyQuery("SELECT 1")).rejects.toBeInstanceOf(ZnunyUnavailableError);
  });

  it("otros errores se propagan tal cual", async () => {
    const { znunyReadOnlyQuery, ZnunyUnavailableError } = await loadDb();
    queryMock.mockRejectedValue(Object.assign(new Error("sintaxis"), { code: "ER_PARSE_ERROR" }));
    const err = await znunyReadOnlyQuery("SELECT 1").catch((e) => e);
    expect(err).not.toBeInstanceOf(ZnunyUnavailableError);
    expect(err.code).toBe("ER_PARSE_ERROR");
  });

  it("ZNUNY_DB_PORT vacío o inválido -> 3306; definido -> ese puerto", async () => {
    queryMock.mockResolvedValue([[]]);
    for (const [value, expected] of [["", 3306], ["abc", 3306], ["3307", 3307]] as const) {
      process.env.ZNUNY_DB_PORT = value;
      const { znunyReadOnlyQuery } = await loadDb();
      createPoolMock.mockClear();
      await znunyReadOnlyQuery("SELECT 1");
      expect(createPoolMock).toHaveBeenCalledWith(expect.objectContaining({ port: expected }));
    }
    delete process.env.ZNUNY_DB_PORT;
    const { znunyReadOnlyQuery } = await loadDb();
    createPoolMock.mockClear();
    await znunyReadOnlyQuery("SELECT 1");
    expect(createPoolMock).toHaveBeenCalledWith(expect.objectContaining({ port: 3306 }));
  });
});
