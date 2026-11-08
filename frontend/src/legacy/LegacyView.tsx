import { useEffect, useMemo, useState } from "react";
import { credentialedRequest, fetchLegacyMeta, fetchLegacyTickets } from "../api/client";
import { LegacyMetricsView } from "./LegacyMetricsView";
import { computeLegacyStats } from "./legacyStats";
import { LegacyMeta, LegacySite, LegacyTicket } from "./types";

function formatFrozenDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/El_Salvador",
  });
}

/** Vista "Histórico osTicket": carga sus datos al montarse (solo se monta con su pestaña abierta). */
export function LegacyView() {
  const [tickets, setTickets] = useState<LegacyTicket[] | null>(null);
  const [sites, setSites] = useState<LegacySite[]>([]);
  const [meta, setMeta] = useState<LegacyMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchLegacyTickets(),
      fetchLegacyMeta(),
      credentialedRequest<LegacySite[]>("/api/sites"),
    ])
      .then(([loadedTickets, loadedMeta, loadedSites]) => {
        if (cancelled) return;
        setTickets(loadedTickets);
        setMeta(loadedMeta);
        setSites(loadedSites);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => (tickets ? computeLegacyStats(tickets, sites) : null), [tickets, sites]);

  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-[color:var(--red)]">{error}</div>;
  }
  if (!tickets || !stats || !meta) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="mono-label text-[color:var(--muted)]">Cargando histórico...</p>
      </div>
    );
  }

  const isSnapshot = meta.source === "snapshot";
  const notice = isSnapshot && meta.frozenAt ? `Datos congelados al ${formatFrozenDate(meta.frozenAt)}` : null;

  return (
    <LegacyMetricsView
      tickets={tickets}
      sites={sites}
      stats={stats}
      showOsTicketLink={meta.source === "live"}
      notice={notice}
    />
  );
}
