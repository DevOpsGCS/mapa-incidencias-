import { useMemo } from "react";
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
    <div className="hud-scale glass-panel fixed bottom-5 right-5 top-[78px] z-10 flex w-[280px] flex-col overflow-hidden">
      <h3 className="mono-label border-b border-[color:var(--glass-border)] px-4 py-3.5 text-[11px] text-[color:var(--muted)]">
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
              className={`flex w-full items-center gap-2.5 border-b border-white/[0.04] px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04] ${
                active ? "border-l-[3px] border-l-[#4C7FFF] bg-[#4C7FFF]/10 pl-[13px]" : ""
              }`}
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: SEVERITY_COLORS[severity] }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-[color:var(--text)]">
                  {site.name}
                </span>
                <span className="mono-label block text-[9.5px] text-[color:var(--muted)]">
                  {SITE_TYPE_LABELS[site.type]}
                </span>
              </span>
              <span className="font-mono text-[13px] text-[color:var(--muted)]">
                {stat?.open ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
