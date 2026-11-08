/** Aviso para usuarios sin `allowedQueues` configurado (acceso a Znuny pendiente de asignar). */
export function NoQueueAccessBanner() {
  return (
    <div
      role="status"
      className="hud-scale fixed left-1/2 top-[78px] z-40 -translate-x-1/2 rounded-lg border border-[#F5A623]/40 bg-[#2a2010]/90 px-4 py-2 text-sm text-[#F7B84F]"
    >
      Tu acceso a colas aún no fue configurado; contactá a un administrador.
    </div>
  );
}
