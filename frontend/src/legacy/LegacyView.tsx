import { useEffect, useState } from "react";
import { credentialedRequest, fetchLegacyMeta, fetchLegacyTickets } from "../api/client";
import osTicketLogo from "../img/osticketlogo.png";
import { LegacyTicketsTable } from "./LegacyTicketsTable";
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

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--data-p0-text)" }}>
        {error}
      </div>
    );
  }
  if (!tickets || !meta) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">Cargando histórico...</p>
      </div>
    );
  }

  const notice = meta.source === "snapshot" && meta.frozenAt ? `Datos congelados al ${formatFrozenDate(meta.frozenAt)}` : null;

  return (
    <div className="thin-scroll h-full overflow-y-auto px-5 pb-6 pt-[92px]">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <img src={osTicketLogo} alt="osTicket" className="h-7 w-7 rounded-[6px] object-cover" />
          <h1 className="text-[22px] font-bold leading-tight text-text-strong">Histórico osTicket</h1>
          {notice && (
            <span
              className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium"
              style={{ background: "rgba(245,166,35,.14)", color: "var(--data-p1-text)" }}
            >
              {notice}
            </span>
          )}
        </header>
        <LegacyTicketsTable tickets={tickets} sites={sites} showOsTicketLink={meta.source === "live"} />
      </div>
    </div>
  );
}
