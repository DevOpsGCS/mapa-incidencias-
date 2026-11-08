import { Router } from "express";
import { requireAuth } from "../auth";
import { respondZnunyError } from "../lib/znunyErrors";
import { usersRepository } from "../repositories/usersRepository";
import { getCatalog } from "../znuny/catalogRepository";

export const catalogRouter = Router();

catalogRouter.use(requireAuth);

catalogRouter.get("/catalog", async (_req, res, next) => {
  try {
    res.json(await getCatalog());
  } catch (error) {
    respondZnunyError(error, res, next);
  }
});

catalogRouter.get("/me/access", (req, res) => {
  const access = usersRepository.getQueueAccess(req.user!.username);
  res.json({ queueAccess: access.kind });
});
