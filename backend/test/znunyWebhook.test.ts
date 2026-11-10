import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { isAuthorizedWebhook, registerWakeTarget, znunyWebhookRouter } from "../src/routes/znunyWebhook";

const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;

function app() {
  const a = express();
  a.use("/api/znuny", znunyWebhookRouter);
  return a;
}

afterEach(() => {
  delete process.env.ZNUNY_WEBHOOK_TOKEN;
  delete process.env.ZNUNY_WEBHOOK_USER;
});

describe("isAuthorizedWebhook", () => {
  it("acepta solo usuario y token exactos", () => {
    expect(isAuthorizedWebhook(basic("znuny", "s3cr3t"), "znuny", "s3cr3t")).toBe(true);
    expect(isAuthorizedWebhook(basic("znuny", "otro"), "znuny", "s3cr3t")).toBe(false);
    expect(isAuthorizedWebhook(basic("x", "s3cr3t"), "znuny", "s3cr3t")).toBe(false);
    expect(isAuthorizedWebhook(undefined, "znuny", "s3cr3t")).toBe(false);
    expect(isAuthorizedWebhook("Bearer s3cr3t", "znuny", "s3cr3t")).toBe(false);
  });
});

describe("POST /api/znuny/webhook", () => {
  it("sin token configurado: 404 (push desactivado) y no despierta pollers", async () => {
    const wake = vi.fn();
    registerWakeTarget(wake);
    const res = await request(app()).post("/api/znuny/webhook").send({});
    expect(res.status).toBe(404);
    expect(wake).not.toHaveBeenCalled();
  });

  it("credenciales incorrectas: 401", async () => {
    process.env.ZNUNY_WEBHOOK_TOKEN = "s3cr3t";
    const res = await request(app()).post("/api/znuny/webhook").set("Authorization", basic("znuny", "mal")).send({});
    expect(res.status).toBe(401);
  });

  it("aviso válido: 200 y despierta a los pollers", async () => {
    process.env.ZNUNY_WEBHOOK_TOKEN = "s3cr3t";
    const wake = vi.fn();
    registerWakeTarget(wake);
    const res = await request(app())
      .post("/api/znuny/webhook")
      .set("Authorization", basic("znuny", "s3cr3t"))
      .send({ Event: { Event: "TicketCreate", TicketID: "155" } });
    expect(res.status).toBe(200);
    expect(wake).toHaveBeenCalled();
  });
});
