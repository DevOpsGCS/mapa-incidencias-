import { useMemo } from "react";
import { SELECTION_STYLE_INSET } from "../lib/priorityTint";
import { SEVERITY_COLORS, SITE_TYPE_LABELS } from "../lib/labels";
import { siteSeverity, SiteSeverity } from "../lib/znunyColors";
import { ZnunyStats } from "../lib/znunyStats";
import { Site } from "../types";

interface SiteRailProps {
  sites: Site[];
  siteStatsById: Map<string, ZnunyStats["bySite"][number]>;
  selectedSiteId?: string;
  onSelectSite: (site: Site) => void;
}

const SEVERITY_RANK: Record<SiteSeverity, number> = { urgente: 0, warning: 1, idle: 2 };

export function SiteRail({ sites, siteStatsById, selectedSiteId, onSelectSite }: SiteRailProps) {
  const sorted = useMemo(() => {
    return [...sites].sort((a, b) => {
      const statA = siteStatsById.get(a.id);
      const statB = siteStatsById.get(b.id);
      const sevA = siteSeverity({ open: statA?.open ?? 0, topPriorityOpen: statA?.topPriorityOpen ?? 0 });
      const sevB = siteSeverity({ open: statB?.open ?? 0, topPriorityOpen: statB?.topPriorityOpen ?? 0 });
      if (SEVERITY_RANK[sevA] !== SEVERITY_RANK[sevB]) {
        return SEVERITY_RANK[sevA] - SEVERITY_RANK[sevB];
      }
      return (statB?.open ?? 0) - (statA?.open ?? 0);
    });
  }, [sites, siteStatsById]);

  return (
    <div className="hud-scale fixed bottom-5 right-5 top-[78px] z-10 flex w-[280px] flex-col overflow-hidden rounded-panel bg-surface-1">
      <h3 className="mono-label px-4 py-3.5 text-[11px] tracking-[0.12em] text-text-label">
        Sitios
      </h3>
      <div className="thin-scroll flex-1 overflow-y-auto">
        {sorted.map((site) => {
          const stat = siteStatsById.get(site.id);
          const severity = siteSeverity({ open: stat?.open ?? 0, topPriorityOpen: stat?.topPriorityOpen ?? 0 });
          const active = site.id === selectedSiteId;

          return (
            <button
              key={site.id}
              type="button"
              onClick={() => onSelectSite(site)}
              style={active ? SELECTION_STYLE_INSET : undefined}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: SEVERITY_COLORS[severity] }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-text-strong">
                  {site.name}
                </span>
                <span className="mono-label block text-[11px] tracking-[0.12em] text-text-label">
                  {SITE_TYPE_LABELS[site.type]}
                </span>
              </span>
              <span className="font-mono text-[13px] text-text">
                {stat?.open ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
