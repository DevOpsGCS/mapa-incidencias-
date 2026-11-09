const DESK_DOWN_RE = /mesa de servicio no disponible/i;

/** Decide qué avisos de conexión mostrar: el error genérico solo se suprime si dice lo mismo que el aviso de mesa caída. */
export function bannerState(error: string | null, serviceDeskOk: boolean): {
  deskDown: boolean;
  genericError: string | null;
} {
  const errorIsDeskDown = error !== null && DESK_DOWN_RE.test(error);
  return {
    deskDown: !serviceDeskOk || errorIsDeskDown,
    genericError: error !== null && !errorIsDeskDown ? error : null,
  };
}
