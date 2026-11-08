import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCatalog } from "../api/client";
import { nextBackoffMs } from "../lib/backoff";
import { Catalog } from "../types";

/**
 * Catálogo de Znuny (colas, estados, prioridades...). Si falla (p. ej. 503
 * con el túnel caído) reintenta con backoff hasta lograrlo; un refresco que
 * falle después conserva el último catálogo bueno. `refresh` lo vuelve a
 * pedir ya (se usa al reconectar el socket).
 */
export function useCatalog(): { catalog: Catalog | null; error: string | null; refresh: () => void } {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const aliveRef = useRef(true);

  const load = useCallback(() => {
    clearTimeout(timerRef.current);
    fetchCatalog()
      .then((loaded) => {
        if (!aliveRef.current) return;
        attemptRef.current = 0;
        setCatalog(loaded);
        setError(null);
      })
      .catch((err: Error) => {
        if (!aliveRef.current) return;
        setError(err.message);
        timerRef.current = setTimeout(load, nextBackoffMs(attemptRef.current));
        attemptRef.current += 1;
      });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, [load]);

  return { catalog, error, refresh: load };
}
