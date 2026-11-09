import { describe, expect, it } from "vitest";
import { bannerState } from "../src/lib/bannerState";

describe("bannerState", () => {
  it("503 de mesa + mesa caída: solo el aviso de mesa", () => {
    expect(bannerState("Mesa de servicio no disponible", false)).toEqual({ deskDown: true, genericError: null });
  });
  it("otro error + mesa caída: ambos avisos", () => {
    expect(bannerState("Failed to fetch", false)).toEqual({ deskDown: true, genericError: "Failed to fetch" });
  });
  it("otro error + mesa ok: solo el genérico", () => {
    expect(bannerState("HTTP 500", true)).toEqual({ deskDown: false, genericError: "HTTP 500" });
  });
  it("sin error y mesa ok: nada", () => {
    expect(bannerState(null, true)).toEqual({ deskDown: false, genericError: null });
  });
});
