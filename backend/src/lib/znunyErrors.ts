import { NextFunction, Response } from "express";
import { ZnunyUnavailableError } from "../znuny/db";

/** Traduce ZnunyUnavailableError a 503; cualquier otro error sigue a next(error). */
export function respondZnunyError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ZnunyUnavailableError) {
    res.status(503).json({ error: "Mesa de servicio no disponible" });
    return;
  }
  next(error);
}
