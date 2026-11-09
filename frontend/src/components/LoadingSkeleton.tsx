/** Esqueleto de carga: paneles grises animados en las posiciones de KPI, rail y mapa. */
export function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Cargando dashboard…" className="relative h-full w-full bg-bg">
      <span className="sr-only">Cargando dashboard…</span>
      <div className="absolute inset-0 animate-pulse bg-surface-1 opacity-40" />
      <div className="hud-scale fixed left-5 top-[78px] flex w-[190px] flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-panel bg-surface-2 opacity-70" />
        ))}
      </div>
      <div className="hud-scale fixed bottom-5 right-5 top-[78px] w-[280px] animate-pulse rounded-panel bg-surface-2 opacity-70" />
    </div>
  );
}
