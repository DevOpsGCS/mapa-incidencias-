import { NextFunction, Response } from "express";

const LEGACY_UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
  "ENOTFOUND",
  "PROTOCOL_CONNECTION_LOST",
  "ER_ACCESS_DENIED_ERROR",
  "LEGACY_DB_NOT_CONFIGURED",
]);

/** osTicket inalcanzable o sin configurar (DB_* ausente) -> 503 claro en vez de 500. */
export function respondLegacyDbError(error: unknown, res: Response, next: NextFunction): void {
  const code = (error as { code?: string } | null)?.code;
  if (code && LEGACY_UNAVAILABLE_CODES.has(code)) {
    res.status(503).json({ error: "osTicket no disponible" });
    return;
  }
  next(error);
}
