import {
  IconArrowLeft,
  IconBuilding,
  IconHome,
  IconPlugConnected,
  IconSearch,
  IconStack2,
  IconUsers,
} from "@tabler/icons-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { fetchConfiguredSites, fetchUsers } from "../api/adminClient";
import { useAuth } from "../auth/AuthContext";
import logo from "../img/logo_gcs_blanco.png";
import { searchAdmin } from "../lib/adminSearch";
import { SELECTION_STYLE } from "../lib/priorityTint";
import { AdminUserSummary, Site } from "../types";
import { ADMIN_NAV, AdminNavIcon } from "./adminNav";
import { MapBackdrop } from "../components/MapBackdrop";

export interface AdminCrumb {
  label: string;
  to?: string;
}

interface AdminLayoutProps {
  title: string;
  crumbs: AdminCrumb[];
  children: ReactNode;
}

const ICONS: Record<AdminNavIcon, typeof IconHome> = {
  home: IconHome,
  users: IconUsers,
  sites: IconBuilding,
  queues: IconStack2,
  status: IconPlugConnected,
};

function initialsOf(username: string | undefined): string {
  if (!username) return "?";
  return username.slice(0, 2).toUpperCase();
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Carga perezosa: solo cuando el usuario entra al buscador; si falla, reintenta al próximo foco.
  const load = () => {
    if (loaded) return;
    setLoaded(true);
    fetchUsers().then(setUsers, () => setLoaded(false));
    fetchConfiguredSites().then(setSites, () => setLoaded(false));
  };

  const results = useMemo(() => searchAdmin(query, users, sites), [query, users, sites]);

  const go = (kind: "user" | "site", id: string) => {
    setOpen(false);
    setQuery("");
    navigate(`/admin/${kind === "user" ? "users" : "sites"}?open=${encodeURIComponent(id)}`);
  };

  return (
    <div className="relative w-[360px] max-w-full">
      <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-label" />
      <input
        type="search"
        value={query}
        placeholder="Buscar usuarios, sitios…"
        aria-label="Buscar usuarios y sitios"
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) go(results[0].kind, results[0].id);
          if (e.key === "Escape") setOpen(false);
        }}
        className="h-8 w-full rounded-[6px] bg-surface-2 pl-8 pr-2 text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {open && query.trim() !== "" && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-card bg-surface-2">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted">Sin resultados</li>
          ) : (
            results.map((r) => (
              <li key={`${r.kind}:${r.id}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(r.kind, r.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-text hover:bg-surface-3 hover:text-text-strong"
                >
                  <span className="truncate">{r.label}</span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-text-label">
                    {r.kind === "user" ? "Usuario" : "Sitio"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function AdminLayout({ title, crumbs, children }: AdminLayoutProps) {
  const { user } = useAuth();

  useEffect(() => {
    document.title = `${title} · Administración`;
  }, [title]);

  return (
    <div className="isolate min-h-screen bg-bg text-text">
      <MapBackdrop />
      <header className="fixed inset-x-0 top-0 z-20 flex h-11 items-center gap-4 glass px-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Global Customs Solutions" className="h-6 w-auto" />
          <span className="text-sm text-text-strong">Administración · Mapa de Incidencias</span>
        </div>
        <div className="flex flex-1 justify-center">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-sm text-text transition-colors hover:text-text-strong"
          >
            <IconArrowLeft size={14} stroke={2} />
            Volver al mapa
          </Link>
          <div
            title={user?.username}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-fill text-[11px] font-bold text-text-strong"
          >
            {initialsOf(user?.username)}
          </div>
        </div>
      </header>

      <nav
        aria-label="Navegación de administración"
        className="fixed bottom-0 left-0 top-11 z-10 w-[210px] thin-scroll overflow-y-auto glass px-2 py-3"
      >
        {ADMIN_NAV.map((group, gi) => (
          <div key={group.group ?? `g${gi}`} className={gi > 0 ? "mt-4" : ""}>
            {group.group && (
              <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-text-label">
                {group.group}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/admin"}
                  className="mb-0.5 flex items-center gap-2.5 rounded-[6px] px-3 py-2 text-sm text-text transition-colors hover:text-text-strong"
                  style={({ isActive }) => (isActive ? SELECTION_STYLE : undefined)}
                >
                  <Icon size={16} stroke={1.75} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <main className="ml-[210px] min-h-screen px-8 pb-10 pt-[68px]">
        <nav aria-label="Migas de pan" className="flex items-center gap-1.5 text-xs text-text-muted">
          {crumbs.map((c, i) => (
            <span key={`${c.label}:${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.to ? (
                <Link to={c.to} className="text-accent-text hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <h1 className="mb-5 mt-2 text-[22px] font-medium text-text-strong">{title}</h1>
        {children}
      </main>
    </div>
  );
}
