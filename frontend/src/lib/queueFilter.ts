/** Separador de jerarquía de colas en Znuny. */
export const QUEUE_SEPARATOR = "::";

/** Cola raíz de un nombre completo ("A::B" → "A"). */
export function rootQueue(queue: string): string {
  return queue.split(QUEUE_SEPARATOR)[0];
}

/**
 * Filtro de cola en árbol: seleccionar "A" coincide con "A" y con "A::…",
 * pero no con colas que solo comparten prefijo de texto ("AX"). null = todas.
 */
export function matchesQueueFilter(ticketQueue: string, selected: string | null): boolean {
  if (selected === null) return true;
  return ticketQueue === selected || ticketQueue.startsWith(selected + QUEUE_SEPARATOR);
}
