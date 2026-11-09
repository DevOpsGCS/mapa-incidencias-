import { IconLock } from "@tabler/icons-react";

/**
 * Aviso para usuarios sin `allowedQueues` configurado (acceso a la Mesa de Servicio pendiente de asignar).
 * Sin posición propia: App lo apila con los demás avisos en un contenedor fijo.
 */
export function NoQueueAccessBanner() {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-full bg-surface-3 px-4 py-2 text-sm text-text-strong"
    >
      <IconLock size={16} stroke={2} style={{ color: "var(--data-p1)" }} />
      Tu acceso a colas aún no fue configurado; contactá a un administrador.
    </div>
  );
}
