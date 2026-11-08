import { Router } from "express";
import { requireAuth } from "../auth";
import { fetchLegacyTickets, getLegacyMeta } from "../legacy/osticket/source";
import { usersRepository } from "../repositories/usersRepository";

export const legacyRouter = Router();

legacyRouter.use(requireAuth);

// Histórico de osTicket: sigue scopeado por allowedDepartments (no por cola).
legacyRouter.get("/osticket/tickets", async (req, res, next) => {
  try {
    const allowedDepartments = usersRepository.getAllowedDepartments(req.user!.username);
    res.json(await fetchLegacyTickets(allowedDepartments));
  } catch (error) {
    next(error);
  }
});

legacyRouter.get("/osticket/meta", async (_req, res, next) => {
  try {
    res.json(await getLegacyMeta());
  } catch (error) {
    next(error);
  }
});
