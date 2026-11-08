import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { SESSION_COOKIE_NAME, verifySessionTokenRaw } from "./auth";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { sitesRouter } from "./routes/sites";
import { ticketsRouter } from "./routes/tickets";
import { usersRepository } from "./repositories/usersRepository";

const PORT = Number(process.env.PORT ?? 4000);
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",");

const app = express();
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

// Room "all-departments": todo cliente sin restricción configurada (el
// caso de hoy para todo el mundo). Rooms "department:<nombre>": clientes
// con allowedDepartments (histórico osTicket).
io.on("connection", (socket) => {
  const { username } = socket.data.session as { username: string };
  const allowedDepartments = usersRepository.getAllowedDepartments(username);
  if (allowedDepartments) {
    for (const department of allowedDepartments) {
      socket.join(`department:${department}`);
    }
  } else {
    socket.join("all-departments");
  }

  console.log(`[socket] cliente conectado: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[socket] cliente desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`API + socket.io escuchando en http://localhost:${PORT}`);
});
