import { useEffect, useState } from "react";
import { fetchCatalog } from "../api/client";
import { Catalog } from "../types";

/** Catálogo de Znuny (colas, estados, prioridades...) — se pide una vez al montar. */
export function useCatalog(): { catalog: Catalog | null; error: string | null } {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((loaded) => {
        if (!cancelled) setCatalog(loaded);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, error };
}
