/**
 * Aviso para usuarios sin `allowedQueues` configurado (acceso a Znuny pendiente de asignar).
 * Sin posición propia: App lo apila con los demás avisos en un contenedor fijo.
 */
export function NoQueueAccessBanner() {
  return (
    <div
      role="status"
      className="rounded-lg border border-[#F5A623]/40 bg-[#2a2010]/90 px-4 py-2 text-sm text-[#F7B84F]"
    >
      Tu acceso a colas aún no fue configurado; contactá a un administrador.
    </div>
  );
}
