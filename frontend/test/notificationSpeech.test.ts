import { describe, expect, it } from "vitest";
import { buildNotificationSpeech } from "../src/lib/notificationSpeech";

const ticket = {
  title: "Impresora tira mensaje de tóner casi agotado",
  priority: "alta",
  queue: "Tecnología::Servicios IT",
  state: "nuevo",
  siteName: "Santa Elena",
};

describe("buildNotificationSpeech", () => {
  it("ticket nuevo: tipo, prioridad, sitio, título, cola y estado", () => {
    expect(buildNotificationSpeech({ kind: "new", ticket })).toBe(
      "Ticket nuevo, prioridad alta, en Santa Elena. Impresora tira mensaje de tóner casi agotado. Cola Tecnología, Servicios IT. Estado nuevo."
    );
  });

  it("cambio de estado: dice de qué estado a qué estado pasó", () => {
    expect(
      buildNotificationSpeech({ kind: "status_changed", ticket: { ...ticket, state: "cerrado" }, previousState: "abierto" })
    ).toBe(
      "Cambio de estado, prioridad alta, en Santa Elena. Impresora tira mensaje de tóner casi agotado. Cola Tecnología, Servicios IT. Pasó de abierto a cerrado."
    );
  });

  it("sin sitio mapeado usa la clave cruda, y si no hay, 'sin sitio'", () => {
    expect(buildNotificationSpeech({ kind: "new", ticket: { ...ticket, siteName: null, siteKey: "Oficina Diaspora" } })).toContain(
      "en Oficina Diaspora."
    );
    expect(buildNotificationSpeech({ kind: "new", ticket: { ...ticket, siteName: null, siteKey: null } })).toContain(
      "prioridad alta, sin sitio."
    );
  });
});
