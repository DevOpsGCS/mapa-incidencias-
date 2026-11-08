import { Router } from "express";
import { requireAuth } from "../auth";
import { sitesRepository } from "../repositories/sitesRepository";
import { getSiteOptions } from "../znuny/catalogRepository";

export const sitesRouter = Router();

sitesRouter.use(requireAuth);

// El nombre visible es la etiqueta en vivo de Znuny; si la clave ya no está
// o Znuny está caído se usa el nombre guardado, sin fallar.
sitesRouter.get("/", async (_req, res) => {
  const sites = sitesRepository.findAll();
  let labels = new Map<string, string>();
  try {
    labels = new Map((await getSiteOptions()).map((o) => [o.key, o.label]));
  } catch {
    // Znuny no disponible: nombres guardados.
  }
  res.json(
    sites.map((site) => ({
      ...site,
      name: (site.znunyKey && labels.get(site.znunyKey)) || site.name,
    }))
  );
});
