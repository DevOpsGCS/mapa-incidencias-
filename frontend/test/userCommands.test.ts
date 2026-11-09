import { describe, expect, it } from "vitest";
import { commandState, profilePatch } from "../src/lib/userCommands";
import { AdminUserSummary } from "../src/types";

function user(username: string, over: Partial<AdminUserSummary> = {}): AdminUserSummary {
  return {
    username,
    email: `${username}@gcs.com`,
    role: "normal",
    allowedDepartments: [],
    allowedQueues: null,
    unknownQueues: [],
    ...over,
  };
}

const users = [
  user("ana", { role: "admin" }),
  user("beto", { role: "admin" }),
  user("carla"),
  user("dani"),
];

describe("commandState", () => {
  it("restablecer contraseña solo con exactamente 1 seleccionado", () => {
    expect(commandState(["carla"], users, "ana").resetPassword).toBe(true);
    expect(commandState([], users, "ana").resetPassword).toBe(false);
    expect(commandState(["carla", "dani"], users, "ana").resetPassword).toBe(false);
  });

  it("sin selección: eliminar deshabilitado sin motivo", () => {
    expect(commandState([], users, "ana").delete).toEqual({ enabled: false, reason: null });
  });

  it("si la selección incluye al usuario actual, bloquea con motivo propio", () => {
    const state = commandState(["carla", "ana"], users, "Ana");
    expect(state.delete).toEqual({ enabled: false, reason: "No podés eliminar tu propio usuario" });
  });

  it("si eliminar deja 0 administradores, bloquea con el motivo de admins", () => {
    const state = commandState(["ana", "beto"], users, "carla");
    expect(state.delete).toEqual({ enabled: false, reason: "Tiene que quedar al menos un administrador" });
  });

  it("caso válido: habilitado", () => {
    expect(commandState(["carla", "dani"], users, "ana").delete).toEqual({ enabled: true, reason: null });
    expect(commandState(["beto"], users, "ana").delete.enabled).toBe(true);
  });
});

describe("profilePatch", () => {
  const original = user("carla", { allowedDepartments: ["TI", "Ventas"], allowedQueues: ["A", "B"] });
  const same = {
    username: "carla",
    email: "carla@gcs.com",
    allowedQueues: ["A", "B"] as string[] | null,
    allowedDepartments: ["TI", "Ventas"],
  };

  it("sin cambios: payload vacío", () => {
    expect(profilePatch(original, same)).toEqual({});
  });

  it("departamentos iguales en otro orden: el campo no sale", () => {
    expect(profilePatch(original, { ...same, allowedDepartments: ["Ventas", "TI"] })).not.toHaveProperty(
      "allowedDepartments"
    );
  });

  it("colas sin cambios (aunque en otro orden): el campo no sale", () => {
    expect(profilePatch(original, { ...same, allowedQueues: ["B", "A"] })).not.toHaveProperty("allowedQueues");
  });

  it("si cambia solo el email, sale solo email", () => {
    expect(profilePatch(original, { ...same, email: "nuevo@gcs.com" })).toEqual({ email: "nuevo@gcs.com" });
  });

  it("incluye departamentos y colas cuando sí cambian", () => {
    expect(profilePatch(original, { ...same, allowedDepartments: ["TI"], allowedQueues: null })).toEqual({
      allowedDepartments: ["TI"],
      allowedQueues: null,
    });
  });

  it("cambio de usuario sale como username", () => {
    expect(profilePatch(original, { ...same, username: "carla2" })).toEqual({ username: "carla2" });
  });
});
