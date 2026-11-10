/**
 * SOLO DESARROLLO: botones para disparar notificaciones de prueba (campanada +
 * tarjeta + voz) con un ticket real ya cargado, sin tocar datos. App.tsx lo
 * monta solo con import.meta.env.DEV, así que no existe en producción.
 */
export function DevNotificationTester({ onTest }: { onTest: (kind: "new" | "status_changed") => void }) {
  const btn = "rounded-full bg-surface-3 px-3 py-1.5 text-xs text-text-strong hover:bg-surface-2";
  return (
    <div className="fixed top-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-3 py-2">
      <span className="mono-label text-[10px] text-text-label">Solo local</span>
      <button type="button" className={btn} onClick={() => onTest("new")}>
        Probar ticket nuevo
      </button>
      <button type="button" className={btn} onClick={() => onTest("status_changed")}>
        Probar cambio de estado
      </button>
    </div>
  );
}
