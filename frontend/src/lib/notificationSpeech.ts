import { isSoundMuted } from "./notificationSound";

/**
 * Voz de las notificaciones: después de la campanada, el navegador lee en
 * español lo mismo que muestra la tarjeta (Web Speech API, sin servicios
 * externos). Respeta el mismo botón de silencio que la campanada.
 *
 * El número de ticket no se lee: son 15 dígitos y el sintetizador los dice
 * como una cifra enorme ("doscientos dos billones…").
 */

export interface SpeechNotification {
  kind: "new" | "status_changed" | "queue_changed" | "owner_changed";
  ticket: {
    title: string;
    priority: string;
    queue: string;
    state: string;
    siteName?: string | null;
    siteKey?: string | null;
  };
  previousState?: string;
  change?: { from: string | null; to: string };
}

const SPEECH_HEAD: Record<SpeechNotification["kind"], string> = {
  new: "Ticket nuevo",
  status_changed: "Cambio de estado",
  queue_changed: "Ticket movido de cola",
  owner_changed: "Ticket reasignado",
};

const spokenQueue = (q: string) => q.split("::").join(", ");

/** Texto que se lee (función pura, testeable). */
export function buildNotificationSpeech(n: SpeechNotification): string {
  const t = n.ticket;
  const site = t.siteName || t.siteKey;
  const queue = spokenQueue(t.queue);
  const head = SPEECH_HEAD[n.kind];
  const parts = [`${head}, prioridad ${t.priority}, ${site ? `en ${site}` : "sin sitio"}.`, `${t.title}.`, `Cola ${queue}.`];
  if (n.kind === "queue_changed" && n.change) {
    const { from, to } = n.change;
    parts[2] = from ? `Pasó de ${spokenQueue(from)} a ${spokenQueue(to)}.` : `Ahora en la cola ${spokenQueue(to)}.`;
    return parts.join(" ");
  }
  if (n.kind === "owner_changed" && n.change) {
    const { from, to } = n.change;
    parts.push(from ? `Pasó de ${from} a ${to}.` : `Asignado a ${to}.`);
    return parts.join(" ");
  }
  if (n.kind === "status_changed" && n.previousState && n.previousState !== t.state) {
    parts.push(`Pasó de ${n.previousState} a ${t.state}.`);
  } else {
    parts.push(`Estado ${t.state}.`);
  }
  return parts.join(" ");
}

/** Lo que dura la campanada (2 tonos de ~0,25 s): la voz arranca después. */
const AFTER_CHIME_MS = 500;
/** Si llegan muchas juntas (p. ej. una ráfaga), no se encolan más de estas lecturas. */
const MAX_QUEUED = 3;

let queued = 0;

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** Prefiere una voz en español latinoamericano; si no hay, cualquier español. */
function pickSpanishVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = s.getVoices();
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  const preferred = ["es-us", "es-mx", "es-419", "es-sv"];
  for (const lang of preferred) {
    const v = es.find((x) => x.lang.toLowerCase() === lang);
    if (v) return v;
  }
  return es[0] ?? null;
}

function utterance(s: SpeechSynthesis, text: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickSpanishVoice(s);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "es-US";
  u.rate = 1;
  return u;
}

/**
 * Al activar el sonido: confirma en voz alta (así se escucha cómo suena) y,
 * de paso, desbloquea la voz — algunos navegadores (Chrome) solo permiten
 * hablar después de un gesto del usuario; el clic del login también cuenta.
 */
export function primeSpeech() {
  const s = synth();
  if (!s) return;
  s.cancel();
  s.speak(utterance(s, "Sonido y voz de notificaciones activados."));
}

/** Lee la notificación después de la campanada (si el sonido no está silenciado). */
export function announceNotification(n: SpeechNotification) {
  const s = synth();
  if (!s || isSoundMuted() || queued >= MAX_QUEUED) return;
  queued += 1;
  window.setTimeout(() => {
    const u = utterance(s, buildNotificationSpeech(n));
    const done = () => {
      queued = Math.max(0, queued - 1);
    };
    u.onend = done;
    u.onerror = done;
    if (isSoundMuted()) {
      done();
      return;
    }
    s.speak(u);
  }, AFTER_CHIME_MS);
}

/** Al silenciar, se corta la lectura en curso. */
export function stopSpeech() {
  synth()?.cancel();
  queued = 0;
}
