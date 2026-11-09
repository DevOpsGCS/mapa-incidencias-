import { useEffect, useMemo, useRef, useState } from "react";
import { SitePanel } from "./SitePanel";
import { KpiDock } from "./KpiDock";
import { MapView } from "./MapView";
import { SiteRail } from "./SiteRail";
import { buildPriorityRankMap } from "../lib/priorityRank";
import { matchesQueueFilter } from "../lib/queueFilter";
import { computeSitePriorityPresence, computeSiteQueueBreakdown } from "../lib/siteDominance";
import { priorityColor } from "../lib/znunyColors";
import { computeZnunyStats } from "../lib/znunyStats";
import { Catalog, Site, Ticket } from "../types";

interface MapHeroViewProps {
  sites: Site[];
  tickets: Ticket[];
  catalog: Catalog;
  selectedSite: Site | null;
  onSelectSite: (site: Site | null) => void;
}

const APPLY_DELAY_MS = 400;

export function MapHeroView({ sites, tickets, catalog, selectedSite, onSelectSite }: MapHeroViewProps) {
  // queue: el filtro que efectivamente se usa para recalcular KPIs/
  // marcadores. selectValue: lo que el selector muestra al toque, para que
  // no "vuelva" a la opción anterior mientras el delay corre.
  const [queue, setQueue] = useState<string | null>(null);
  const [selectValue, setSelectValue] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const applyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(applyTimeoutRef.current), []);

  // El recálculo real (stats/dominancia) sobre el volumen actual de
  // tickets es prácticamente instantáneo — tan rápido que un
  // indicador "de verdad" (ej. useTransition) nunca llega a pintarse antes
  // de que termine. Este delay es deliberado, solo para que el "Cargando..."
  // sea visible una fracción de segundo antes de aplicar el filtro.
  const handleQueueChange = (next: string | null) => {
    setSelectValue(next);
    setIsPending(true);
    clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = setTimeout(() => {
      setQueue(next);
      setIsPending(false);
    }, APPLY_DELAY_MS);
  };

  // Elegir una cola incluye sus subcolas (ver matchesQueueFilter).
  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => matchesQueueFilter(ticket.queue, queue)),
    [tickets, queue]
  );

  const rankById = useMemo(() => buildPriorityRankMap(catalog), [catalog]);

  // KPIs, marcadores y detalle de sitio se recalculan sobre el set filtrado
  // — mismo patrón que ya usa useDashboardData para no depender de un
  // round-trip al backend en cada cambio de filtro.
  const stats = useMemo(
    () => computeZnunyStats(filteredTickets, sites, catalog.topPriorityId),
    [filteredTickets, sites, catalog.topPriorityId]
  );
  const queueBreakdownBySite = useMemo(
    () => computeSiteQueueBreakdown(filteredTickets),
    [filteredTickets]
  );
  const sitePriorityPresenceById = useMemo(
    () => computeSitePriorityPresence(filteredTickets, rankById),
    [filteredTickets, rankById]
  );
  const siteStatsById = useMemo(() => {
    const map = new Map<string, (typeof stats.bySite)[number]>();
    stats.bySite.forEach((entry) => map.set(entry.siteId, entry));
    return map;
  }, [stats.bySite]);

  return (
    <div className="relative h-full w-full">
      {/* z-0 crea un stacking context propio: las capas internas de Leaflet
          (marcadores, controles, atribución) usan z-index de hasta 1000,
          pero quedan atrapadas dentro de este contexto y no pueden
          escaparse por encima de los paneles flotantes (KPI, rail, drawer). */}
      <div className="absolute inset-0 z-0">
        <MapView
          sites={sites}
          queueBreakdownBySite={queueBreakdownBySite}
          sitePriorityPresenceById={sitePriorityPresenceById}
          selectedSiteId={selectedSite?.id}
          onSelectSite={onSelectSite}
        />
      </div>

      <KpiDock
        stats={stats}
        catalog={catalog}
        queue={selectValue}
        onQueueChange={handleQueueChange}
        isPending={isPending}
      />
      <SiteRail
        sites={sites}
        siteStatsById={siteStatsById}
        selectedSiteId={selectedSite?.id}
        onSelectSite={onSelectSite}
      />

      {selectedSite ? (
        <SitePanel
          site={selectedSite}
          tickets={filteredTickets}
          catalog={catalog}
          onClose={() => onSelectSite(null)}
        />
      ) : (
        <MapLegend catalog={catalog} />
      )}
    </div>
  );
}

function MapLegend({ catalog }: { catalog: Catalog }) {
  const priorities = [...catalog.priorities].sort((a, b) => a.rank - b.rank);
  return (
    <div className="hud-scale fixed bottom-5 left-5 z-10 rounded-panel bg-surface-1 px-3.5 py-3 text-xs text-text">
      {priorities.map((priority) => (
        <LegendRow key={priority.id} color={priorityColor(priority.rank)} label={priority.name} />
      ))}
      <LegendRow color="var(--line-strong)" label="Sin tickets de esa prioridad" />
      <p className="mono-label mt-2 text-[11px] text-text-label">
        Clic en un marcador o sitio para ver detalle
      </p>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
