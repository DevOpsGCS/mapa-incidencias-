import { LegacyStatusChart } from "./LegacyStatusChart";
import { LegacyTicketsTable } from "./LegacyTicketsTable";
import { LegacyTrendChart } from "./LegacyTrendChart";
import { LegacySite, LegacyTicket, LegacyStats } from "./types";

interface LegacyMetricsViewProps {
  tickets: LegacyTicket[];
  sites: LegacySite[];
  stats: LegacyStats;
  showOsTicketLink?: boolean;
  /** Aviso sobre el origen de los datos (ej. snapshot congelado). */
  notice?: string | null;
}

export function LegacyMetricsView({ tickets, sites, stats, showOsTicketLink = true, notice = null }: LegacyMetricsViewProps) {
  return (
    <div className="thin-scroll h-full overflow-y-auto px-5 pb-6 pt-[92px]">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-4">
        {notice && (
          <p className="mono-label text-[11px] text-[color:var(--amber)]">{notice}</p>
        )}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <LegacyStatusChart stats={stats} />
          <LegacyTrendChart stats={stats} />
        </section>

        <section>
          <LegacyTicketsTable tickets={tickets} sites={sites} showOsTicketLink={showOsTicketLink} />
        </section>
      </div>
    </div>
  );
}
