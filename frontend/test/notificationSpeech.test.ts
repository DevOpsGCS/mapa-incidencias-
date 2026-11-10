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

describe("buildNotificationSpeech: cola y propietario", () => {
  it("movido de cola: dice de qué cola a qué cola", () => {
    expect(
      buildNotificationSpeech({
        kind: "queue_changed",
        ticket: { ...ticket, queue: "Tecnología::Back Office" },
        change: { from: "Tecnología::Servicios IT", to: "Tecnología::Back Office" },
      })
    ).toBe(
      "Ticket movido de cola, prioridad alta, en Santa Elena. Impresora tira mensaje de tóner casi agotado. Pasó de Tecnología, Servicios IT a Tecnología, Back Office."
    );
  });

  it("reasignado: dice de quién a quién", () => {
    expect(
      buildNotificationSpeech({ kind: "owner_changed", ticket, change: { from: "Cristian Castro", to: "Mariana Ayala" } })
    ).toBe(
      "Ticket reasignado, prioridad alta, en Santa Elena. Impresora tira mensaje de tóner casi agotado. Cola Tecnología, Servicios IT. Pasó de Cristian Castro a Mariana Ayala."
    );
  });

  it("reasignado sin propietario anterior conocido", () => {
    expect(buildNotificationSpeech({ kind: "owner_changed", ticket, change: { from: null, to: "Mariana Ayala" } })).toContain(
      "Asignado a Mariana Ayala."
    );
  });
});

import { shouldSpeak } from "../src/lib/notificationSpeech";

describe("shouldSpeak", () => {
  it("solo los tickets nuevos se leen en voz alta", () => {
    expect(shouldSpeak("new")).toBe(true);
    expect(shouldSpeak("status_changed")).toBe(false);
    expect(shouldSpeak("queue_changed")).toBe(false);
    expect(shouldSpeak("owner_changed")).toBe(false);
  });
});

import { claimSpeech } from "../src/lib/notificationSpeech";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } as Storage;
}

describe("claimSpeech (una sola lectura por aviso entre pestañas)", () => {
  it("la segunda pestaña con el mismo aviso no vuelve a hablar", () => {
    const shared = memoryStorage();
    expect(claimSpeech("new:155", 1_000, shared)).toBe(true);
    expect(claimSpeech("new:155", 1_500, shared)).toBe(false);
  });

  it("otro ticket sí habla", () => {
    const shared = memoryStorage();
    expect(claimSpeech("new:155", 1_000, shared)).toBe(true);
    expect(claimSpeech("new:156", 1_200, shared)).toBe(true);
  });

  it("las reservas viejas (más de 5 min) se descartan", () => {
    const shared = memoryStorage();
    expect(claimSpeech("new:155", 0, shared)).toBe(true);
    expect(claimSpeech("new:155", 6 * 60_000, shared)).toBe(true);
  });

  it("sin localStorage usa la memoria de la pestaña", () => {
    expect(claimSpeech("new:999", 1_000, null)).toBe(true);
    expect(claimSpeech("new:999", 2_000, null)).toBe(false);
  });
});
