/**
 * Bucle de un poller con "despertador": corre `tick` cada `intervalMs` y,
 * además, cuando llega un aviso push de Znuny (wakeUp), adelanta el próximo
 * ciclo. Nunca corre dos ciclos a la vez: si llega un aviso durante un ciclo,
 * se hace UN ciclo más al terminar (varios avisos seguidos se agrupan).
 *
 * El push solo adelanta la lectura: los datos siempre salen de la base de
 * Znuny con el mismo cursor, así que un aviso perdido lo recoge el ciclo
 * periódico y un aviso repetido no genera notificaciones dobles.
 */
export interface PollLoop {
  start(): void;
  /** Adelanta el próximo ciclo (con una pequeña espera para agrupar avisos). */
  wakeUp(): void;
}

export function createPollLoop(tick: () => Promise<void>, intervalMs: number, wakeDelayMs = 300): PollLoop {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let pending = false;

  const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, ms);
  };

  async function run() {
    timer = null;
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      await tick();
    } finally {
      running = false;
      if (pending) {
        pending = false;
        schedule(0);
      } else {
        schedule(intervalMs);
      }
    }
  }

  return {
    start: () => schedule(0),
    wakeUp: () => {
      if (running) {
        pending = true;
        return;
      }
      schedule(wakeDelayMs);
    },
  };
}
