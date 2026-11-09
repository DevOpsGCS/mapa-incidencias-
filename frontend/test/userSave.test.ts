import { describe, expect, it, vi } from "vitest";
import { saveExistingUser } from "../src/lib/userSave";

describe("saveExistingUser", () => {
  it("rol ok + PATCH falla: resultado parcial con mensaje", async () => {
    const api = {
      setUserRole: vi.fn().mockResolvedValue({}),
      updateUserProfile: vi.fn().mockRejectedValue(new Error("Email inválido")),
    };
    const result = await saveExistingUser(api, "ana", "admin", { email: "x" });
    expect(api.setUserRole).toHaveBeenCalledWith("ana", "admin");
    expect(result).toMatchObject({
      status: "partial",
      message: "Rol actualizado; no se pudieron guardar los demás cambios: Email inválido",
    });
  });

  it("PATCH falla sin cambio de rol: propaga el error", async () => {
    const api = { setUserRole: vi.fn(), updateUserProfile: vi.fn().mockRejectedValue(new Error("boom")) };
    await expect(saveExistingUser(api, "ana", null, { email: "x" })).rejects.toThrow("boom");
    expect(api.setUserRole).not.toHaveBeenCalled();
  });

  it("sin cambios: no llama a nada", async () => {
    const api = { setUserRole: vi.fn(), updateUserProfile: vi.fn() };
    expect(await saveExistingUser(api, "ana", null, {})).toEqual({ status: "ok" });
    expect(api.updateUserProfile).not.toHaveBeenCalled();
  });
});
