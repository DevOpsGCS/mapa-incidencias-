import { timingSafeEqual } from "crypto";
import express, { Router } from "express";

/**
 * Aviso push de Znuny (Web Service "MapaIncidencias", invoker Ticket::Generic
 * por eventos TicketCreate / TicketStateUpdate / TicketQueueUpdate /
 * TicketOwnerUpdate, asíncrono desde el daemon de Znuny).
 *
 * El aviso NO trae los datos que se muestran: solo "despierta" a los pollers
 * para que lean Znuny ya (wakePollers). Así el push baja la demora de ~20 s a
 * ~1 s y, si un aviso se pierde, el ciclo periódico lo recoge igual; un aviso
 * repetido no duplica notificaciones (los cursores deduplican).
 *
 * Autenticación: Basic Auth con ZNUNY_WEBHOOK_USER / ZNUNY_WEBHOOK_TOKEN
 * (configurados igual en el web service de Znuny). Sin token configurado la
 * ruta responde 404 (push desactivado).
 */

type Wake = () => void;
const wakeTargets: Wake[] = [];

/** index.ts registra acá el wakeUp de cada poller al arrancarlos. */
export function registerWakeTarget(wake: Wake): void {
  wakeTargets.push(wake);
}

export function wakePollers(): void {
  for (const wake of wakeTargets) wake();
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** true si el header Authorization trae el Basic Auth esperado. */
export function isAuthorizedWebhook(authHeader: string | undefined, user: string, token: string): boolean {
  if (!authHeader?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  return safeEqual(decoded.slice(0, sep), user) && safeEqual(decoded.slice(sep + 1), token);
}

export const znunyWebhookRouter = Router();

// Parser propio y generoso: si el mapeo de Znuny fallara y mandara el ticket
// completo, el aviso igual tiene que entrar (el body no se usa para datos).
znunyWebhookRouter.post("/webhook", express.json({ limit: "5mb" }), (req, res) => {
  const user = process.env.ZNUNY_WEBHOOK_USER ?? "znuny";
  const token = process.env.ZNUNY_WEBHOOK_TOKEN;
  if (!token) {
    res.status(404).json({ error: "Push desactivado" });
    return;
  }
  if (!isAuthorizedWebhook(req.headers.authorization, user, token)) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  const event = (req.body as { Event?: { Event?: string; TicketID?: string | number } } | undefined)?.Event;
  console.log(`[znuny-push] ${event?.Event ?? "evento"} TicketID=${event?.TicketID ?? "?"}`);
  wakePollers();
  res.json({ ok: true });
});
