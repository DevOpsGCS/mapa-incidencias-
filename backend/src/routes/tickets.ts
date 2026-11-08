import { Router } from "express";
import { requireAuth } from "../auth";
import { ticketsRepository } from "../legacy/osticket/ticketsRepository";
import { usersRepository } from "../repositories/usersRepository";
import { TicketFilters, LegacyTicketPriority, LegacyTicketStatus } from "../types";

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

const VALID_STATUSES: LegacyTicketStatus[] = ["open", "resolved", "closed"];
const VALID_PRIORITIES: LegacyTicketPriority[] = ["low", "normal", "high", "urgente"];

// IMPORTANTE: /stats debe declararse antes de cualquier ruta con parámetro
// dinámico para que Express no intente resolver "stats" como un :id.
ticketsRouter.get("/stats", async (req, res, next) => {
  try {
    // Se relee de usersRepository en cada request (nunca de un valor
    // embebido en el JWT): un cambio de allowedDepartments hecho por el
    // admin aplica en la próxima petición, sin esperar a que expire la sesión.
    const allowedDepartments = usersRepository.getAllowedDepartments(req.user!.username);
    res.json(await ticketsRepository.getStats(allowedDepartments));
  } catch (error) {
    next(error);
  }
});

ticketsRouter.get("/", async (req, res, next) => {
  try {
    const { siteId, status, priority } = req.query;

    const filters: TicketFilters = {};

    if (typeof siteId === "string" && siteId.length > 0) {
      filters.siteId = siteId;
    }

    if (typeof status === "string" && VALID_STATUSES.includes(status as LegacyTicketStatus)) {
      filters.status = status as LegacyTicketStatus;
    }

    if (
      typeof priority === "string" &&
      VALID_PRIORITIES.includes(priority as LegacyTicketPriority)
    ) {
      filters.priority = priority as LegacyTicketPriority;
    }

    const allowedDepartments = usersRepository.getAllowedDepartments(req.user!.username);
    res.json(await ticketsRepository.findAll(filters, allowedDepartments));
  } catch (error) {
    next(error);
  }
});
