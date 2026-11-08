import { Router } from "express";
import { requireAuth } from "../auth";
import { respondZnunyError } from "../lib/znunyErrors";
import { usersRepository } from "../repositories/usersRepository";
import { findAllTickets } from "../znuny/ticketsRepository";

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

// Se relee de usersRepository en cada request (nunca de un valor embebido en
// el JWT): un cambio de colas hecho por el admin aplica en la próxima petición.
// El scoping por cola se aplica en el SQL (findAllTickets), no en JS.
ticketsRouter.get("/", async (req, res, next) => {
  try {
    const access = usersRepository.getQueueAccess(req.user!.username);
    res.json(await findAllTickets(access));
  } catch (error) {
    respondZnunyError(error, res, next);
  }
});
