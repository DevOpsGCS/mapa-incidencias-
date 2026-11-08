import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { SESSION_COOKIE_NAME, verifySessionTokenRaw } from "./auth";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { catalogRouter } from "./routes/catalog";
import { legacyRouter } from "./routes/legacy";
import { sitesRouter } from "./routes/sites";
import { ticketsRouter } from "./routes/tickets";
import { usersRepository } from "./repositories/usersRepository";
import { roomsForAccess } from "./znuny/queueAccess";
import { startZnunyStatePoller } from "./sockets/znunyStatePoller";
import { startZnunyTicketPoller } from "./sockets/znunyTicketPoller";

const PORT = Number(process.env.PORT ?? 4000);
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",");

export const app = express();
// Detrás de nginx en producción: sin esto, req.ip siempre da la IP interna
// de nginx (127.0.0.1), no la del cliente real — y el rate-limit de
// /api/auth/forgot-password por IP quedaría inútil (todo el tráfico
// contaría como una sola IP).
app.set("trust proxy", 1);
// credentials:true + origin explícito (nunca "*") porque el login depende
// de una cookie httpOnly cross-origin (frontend en :5173, backend en :4000
// en dev).
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/sites", sitesRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/legacy", legacyRouter);
app.use("/api", catalogRouter);

// Servidor http, socket.io, pollers y listen solo al ejecutar el proceso
// (node dist/index.js); las pruebas importan `app` sin abrir puertos.
if (require.main === module) {
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
  });

  /** Extrae un valor de cookie de un header "cookie" crudo — sin agregar una dependencia nueva solo para esto. */
  function readCookieValue(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(";")) {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = part.slice(0, separatorIndex).trim();
      if (key === name) {
        return decodeURIComponent(part.slice(separatorIndex + 1).trim());
      }
    }
    return null;
  }

  // El dashboard ahora exige login para todos: un socket sin sesión válida no
  // debe recibir tickets en vivo, igual que /api/tickets ya lo exige por HTTP.
  io.use((socket, next) => {
    const token = readCookieValue(socket.handshake.headers.cookie, SESSION_COOKIE_NAME);
    const session = token ? verifySessionTokenRaw(token) : null;
    if (!session) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.session = session;
    next();
  });

  // Rooms de Znuny: "all-queues" (acceso total) o "queue:<nombre completo>".
  io.on("connection", (socket) => {
    const { username } = socket.data.session as { username: string };
    socket.join(roomsForAccess(usersRepository.getQueueAccess(username)));

    console.log(`[socket] cliente conectado: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[socket] cliente desconectado: ${socket.id}`);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`API + socket.io escuchando en http://localhost:${PORT}`);
    startZnunyTicketPoller(io);
    startZnunyStatePoller(io);
  });
}
