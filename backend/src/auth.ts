import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { usersRepository } from "./repositories/usersRepository";
import { Role } from "./types";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { username: string; role: Role };
    }
  }
}

export const SESSION_COOKIE_NAME = "session_token";
const SESSION_DURATION = "8h";

interface SessionPayload {
  sub: string;
  role: Role;
}

function getJwtSecretOrThrow(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Falta JWT_SECRET en backend/.env");
  }
  return secret;
}

export function signSessionToken(username: string, role: Role): string {
  return jwt.sign({ sub: username, role }, getJwtSecretOrThrow(), { expiresIn: SESSION_DURATION });
}

function verifySessionToken(token: string): { username: string; role: Role } | null {
  try {
    const payload = jwt.verify(token, getJwtSecretOrThrow());
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof (payload as SessionPayload).sub !== "string" ||
      ((payload as SessionPayload).role !== "admin" && (payload as SessionPayload).role !== "normal")
    ) {
      return null;
    }
    const { sub, role } = payload as SessionPayload;
    return { username: sub, role };
  } catch {
    return null;
  }
}

/**
 * Token válido Y usuario todavía existente. El rol se relee de
 * usersRepository (nunca del JWT): un usuario borrado/renombrado pierde el
 * acceso y un admin degradado pierde el rol de inmediato, aunque su cookie
 * siga vigente hasta 8 h.
 */
export function resolveSessionUser(token: string | null | undefined): { username: string; role: Role } | null {
  const session = token ? verifySessionToken(token) : null;
  if (!session) return null;
  const stored = usersRepository.findByUsername(session.username);
  if (!stored) return null;
  return { username: session.username, role: stored.role };
}

/** Exige sesión válida (cualquier rol) de un usuario existente. Adjunta req.user. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = resolveSessionUser(req.cookies?.[SESSION_COOKIE_NAME]);
  if (!user) {
    res.status(401).json({ error: "No autenticado." });
    return;
  }
  req.user = user;
  next();
}

/** Exige sesión válida Y que el rol ACTUAL del usuario esté en la lista permitida. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = resolveSessionUser(req.cookies?.[SESSION_COOKIE_NAME]);
    if (!user) {
      res.status(401).json({ error: "No autenticado." });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "No autorizado para este recurso." });
      return;
    }
    req.user = user;
    next();
  };
}
