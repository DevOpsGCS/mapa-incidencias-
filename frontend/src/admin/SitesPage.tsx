import { IconMapPin, IconRefresh, IconTrash } from "@tabler/icons-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  deleteSite,
  fetchConfiguredSites,
  fetchSitesWithLiveLabels,
  fetchUnmappedSites,
  saveSite,
  UnmappedSite,
} from "../api/adminClient";
import { UnauthorizedError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SidePanel } from "../components/SidePanel";
import { SITE_TYPE_LABELS } from "../lib/labels";
import { SELECTION_STYLE_INSET } from "../lib/priorityTint";
import { Site, SiteType } from "../types";
import { Pill } from "./Pill";

type ViewTab = "configured" | "unmapped";

const VIEW_TABS: { id: ViewTab; label: string }[] = [
  { id: "configured", label: "Configurados" },
  { id: "unmapped", label: "Sin configurar" },
];

const SITE_TYPES: SiteType[] = ["aduana_terrestre", "aduana_maritima", "aduana_aerea", "sede"];

const GRID_CONFIGURED = "grid grid-cols-[28px_minmax(160px,1.6fr)_minmax(140px,1fr)_minmax(140px,1fr)] items-center gap-3";
const GRID_UNMAPPED = "grid grid-cols-[28px_minmax(160px,1.6fr)_minmax(140px,1fr)] items-center gap-3";

const FIELD_CLASS =
  "h-9 rounded-[6px] border border-line-control bg-surface-2 px-3 text-sm text-text-strong focus:outline-none focus:ring-1 focus:ring-accent";
const INPUT_CLASS = `mt-1 w-full ${FIELD_CLASS}`;
const LABEL_CLASS = "block text-sm text-text-muted";
const ERROR_CLASS = "text-sm text-[color:var(--data-p0-text)]";
const BUTTON_PRIMARY =
  "rounded-full bg-accent-fill px-4 py-1.5 text-sm font-medium text-text-strong hover:opacity-90 disabled:opacity-50";
const BUTTON_SECONDARY =
  "rounded-full border border-line-control px-4 py-1.5 text-sm text-text hover:bg-surface-2 hover:text-text-strong";
const COMMAND_BUTTON =
  "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-sm text-text transition-colors hover:bg-surface-2 hover:text-text-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text";

interface FormState {
  znunyKey: string;
  /** Nombre visible (etiqueta de la Mesa de Servicio) solo para el título del flyout. */
  label: string;
  type: SiteType;
  lat: string;
  lng: string;
}

function parseTab(value: string | null): ViewTab {
  return value === "unmapped" ? "unmapped" : "configured";
}

interface SiteFlyoutProps {
  form: FormState;
  onChange: (next: FormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  error: string | null;
  saving: boolean;
}

function SiteFlyout({ form, onChange, onClose, onSubmit, error, saving }: SiteFlyoutProps) {
  return (
    <SidePanel open onClose={onClose} width={380} label={`Sitio ${form.label}`}>
      <form onSubmit={onSubmit} className="flex h-full flex-col">
        <div className="px-5 pb-3">
          <h2 className="text-lg font-medium text-text-strong">{form.label}</h2>
        </div>
        <div className="min-h-0 flex-1 space-y-4 thin-scroll overflow-y-auto border-t border-line-strong px-5 py-4">
          <label className={LABEL_CLASS}>
            Tipo
            <select
              value={form.type}
              onChange={(e) => onChange({ ...form, type: e.target.value as SiteType })}
              className={INPUT_CLASS}
            >
              {SITE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SITE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3">
            <label className={`${LABEL_CLASS} flex-1`}>
              Latitud
              <input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => onChange({ ...form, lat: e.target.value })}
                required
                autoFocus
                className={INPUT_CLASS}
              />
            </label>
            <label className={`${LABEL_CLASS} flex-1`}>
              Longitud
              <input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => onChange({ ...form, lng: e.target.value })}
                required
                className={INPUT_CLASS}
              />
            </label>
          </div>
          {error && <p className={ERROR_CLASS}>{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line-strong px-5 py-3">
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}

export function SitesPage() {
  const { clearSession } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewTab = parseTab(searchParams.get("tab"));
  const openParam = searchParams.get("open");

  const [configured, setConfigured] = useState<Site[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedSite[]>([]);
  // clave de la Mesa de Servicio -> nombre visible en vivo.
  const [liveNames, setLiveNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  // Configurados se seleccionan por id; sin configurar, por clave.
  const [selected, setSelected] = useState<string[]>([]);
  // La selección solo vale para lo que se ve: al cambiar de pestaña o de filtro se descarta.
  useEffect(() => {
    setSelected([]);
  }, [viewTab, filter]);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sites, options, live] = await Promise.all([
        fetchConfiguredSites(),
        fetchUnmappedSites(),
        // Si falla, se muestran los nombres guardados.
        fetchSitesWithLiveLabels().catch((): Site[] => []),
      ]);
      setConfigured(sites);
      setUnmapped(options);
      setLiveNames(new Map(live.filter((s) => s.znunyKey).map((s) => [s.znunyKey as string, s.name])));
      setSelected((prev) => prev.filter((id) => sites.some((s) => s.id === id) || options.some((o) => o.key === id)));
      setError(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = useCallback(
    (site: Site) => (site.znunyKey && liveNames.get(site.znunyKey)) || site.name,
    [liveNames]
  );

  const openAssignForm = useCallback((option: UnmappedSite) => {
    setFormError(null);
    setForm({ znunyKey: option.key, label: option.label, type: "sede", lat: "", lng: "" });
  }, []);

  const openEditForm = useCallback(
    (site: Site) => {
      if (!site.znunyKey) return;
      setFormError(null);
      setForm({
        znunyKey: site.znunyKey,
        label: displayName(site),
        type: site.type,
        lat: String(site.lat),
        lng: String(site.lng),
      });
    },
    [displayName]
  );

  const setViewTab = (tab: ViewTab) => {
    setSelected([]);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "configured") next.delete("tab");
        else next.set("tab", tab);
        return next;
      },
      { replace: true }
    );
  };

  // ?open=<id del sitio> (buscador global): abre el flyout una vez cargada la lista y limpia el parámetro.
  useEffect(() => {
    if (!openParam || loading) return;
    const site = configured.find((s) => s.id === openParam);
    if (site) {
      openEditForm(site);
    } else {
      const option = unmapped.find((o) => o.key === openParam);
      if (option) openAssignForm(option);
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("open");
        return next;
      },
      { replace: true }
    );
  }, [openParam, loading, configured, unmapped, openEditForm, openAssignForm, setSearchParams]);

  const term = filter.trim().toLowerCase();
  const visibleConfigured = useMemo(
    () => configured.filter((s) => term === "" || displayName(s).toLowerCase().includes(term)),
    [configured, displayName, term]
  );
  const visibleUnmapped = useMemo(
    () => unmapped.filter((o) => term === "" || o.label.toLowerCase().includes(term)),
    [unmapped, term]
  );

  const visibleIds = viewTab === "configured" ? visibleConfigured.map((s) => s.id) : visibleUnmapped.map((o) => o.key);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setSelected(
      allVisibleSelected
        ? selected.filter((id) => !visibleIds.includes(id))
        : [...new Set([...selected, ...visibleIds])]
    );

  const assignTarget =
    viewTab === "unmapped" && selected.length === 1 ? unmapped.find((o) => o.key === selected[0]) : undefined;
  const canDelete = viewTab === "configured" && selected.length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;

    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setFormError("lat y lng deben ser números válidos.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await saveSite({ znunyKey: form.znunyKey, type: form.type, lat, lng });
      setForm(null);
      await load();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el sitio.");
    } finally {
      setSaving(false);
    }
  };

  // El DELETE busca por el nombre guardado; la confirmación muestra el nombre visible.
  const handleDelete = async () => {
    if (!canDelete) return;
    const targets = configured.filter((s) => selected.includes(s.id));
    if (targets.length === 0) return;
    const message =
      targets.length === 1
        ? `¿Quitar coordenadas de "${displayName(targets[0])}"? El sitio deja de verse en el mapa hasta que se vuelva a configurar.`
        : `¿Quitar coordenadas de ${targets.length} sitios? Dejan de verse en el mapa hasta que se vuelvan a configurar.\n\n${targets
            .map((s) => `• ${displayName(s)}`)
            .join("\n")}`;
    if (!window.confirm(message)) return;

    setDeleting(true);
    setError(null);
    try {
      // En secuencia: si uno falla se corta y se informa cuál.
      let done = 0;
      let failure: string | null = null;
      for (const site of targets) {
        try {
          await deleteSite(site.name);
          done += 1;
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            clearSession();
            return;
          }
          const detail = err instanceof Error ? err.message : "error desconocido";
          failure = `Se borraron ${done} de ${targets.length}; falló "${displayName(site)}": ${detail}`;
          break;
        }
      }
      await load();
      if (failure) setError(failure);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-text-muted">Cargando...</p>;
  }

  const grid = viewTab === "configured" ? GRID_CONFIGURED : GRID_UNMAPPED;

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-line-strong">
        {VIEW_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={viewTab === t.id}
            onClick={() => setViewTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              viewTab === t.id
                ? "border-accent text-text-strong"
                : "border-transparent text-text-muted hover:text-text-strong"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-text-label">
              {t.id === "configured" ? configured.length : unmapped.length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 border-b border-line pb-3">
        <button
          type="button"
          disabled={!assignTarget}
          onClick={() => assignTarget && openAssignForm(assignTarget)}
          className={COMMAND_BUTTON}
        >
          <IconMapPin size={15} stroke={2} />
          Asignar coordenadas
        </button>
        <button type="button" onClick={() => load()} className={COMMAND_BUTTON}>
          <IconRefresh size={15} stroke={2} />
          Actualizar
        </button>
        <button type="button" disabled={!canDelete || deleting} onClick={handleDelete} className={COMMAND_BUTTON}>
          <IconTrash size={15} stroke={2} />
          Eliminar
        </button>
        <div className="flex-1" />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por nombre"
          aria-label="Filtrar sitios por nombre"
          className="h-8 w-56 rounded-[6px] border border-line-control bg-surface-2 px-2.5 text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-card border border-line-strong bg-surface-2 px-4 py-2 text-sm text-[color:var(--data-p0-text)]">
          {error}
        </div>
      )}

      <div role="table" aria-label="Sitios" className="glass mt-2 overflow-hidden rounded-card">
        <div
          role="row"
          className={`${grid} px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-label`}
        >
          <input
            type="checkbox"
            aria-label="Seleccionar todos"
            checked={allVisibleSelected}
            onChange={toggleAll}
            className="h-3.5 w-3.5"
          />
          <span role="columnheader">Nombre</span>
          {viewTab === "configured" ? (
            <>
              <span role="columnheader">Tipo</span>
              <span role="columnheader">Coordenadas</span>
            </>
          ) : (
            <span role="columnheader">Estado</span>
          )}
        </div>

        {viewTab === "configured" ? (
          <>
            {visibleConfigured.length === 0 && (
              <p className="px-3 py-6 text-sm text-text-muted">No hay sitios para mostrar.</p>
            )}
            {visibleConfigured.map((site) => {
              const isSelected = selected.includes(site.id);
              return (
                <div
                  key={site.id}
                  role="row"
                  className={`${grid} border-t border-line px-3 py-2.5 text-sm transition-colors hover:bg-surface-2`}
                  style={isSelected ? SELECTION_STYLE_INSET : undefined}
                >
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${displayName(site)}`}
                    checked={isSelected}
                    onChange={() => toggleOne(site.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span role="cell" className="min-w-0 truncate">
                    {site.znunyKey ? (
                      <button
                        type="button"
                        onClick={() => openEditForm(site)}
                        className="text-accent-text hover:underline"
                      >
                        {displayName(site)}
                      </button>
                    ) : (
                      <span
                        className="text-text"
                        title="Sitio sin clave en la Mesa de Servicio: solo existe en el histórico"
                      >
                        {displayName(site)}
                      </span>
                    )}
                  </span>
                  <span role="cell">
                    <Pill>{SITE_TYPE_LABELS[site.type]}</Pill>
                  </span>
                  <span role="cell" className="font-mono text-xs text-text-muted">
                    {site.lat}, {site.lng}
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <>
            {visibleUnmapped.length === 0 && (
              <p className="px-3 py-6 text-sm text-text-muted">No hay sitios sin configurar.</p>
            )}
            {visibleUnmapped.map((option) => {
              const isSelected = selected.includes(option.key);
              return (
                <div
                  key={option.key}
                  role="row"
                  className={`${grid} border-t border-line px-3 py-2.5 text-sm transition-colors hover:bg-surface-2`}
                  style={isSelected ? SELECTION_STYLE_INSET : undefined}
                >
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${option.label}`}
                    checked={isSelected}
                    onChange={() => toggleOne(option.key)}
                    className="h-3.5 w-3.5"
                  />
                  <span role="cell" className="min-w-0 truncate">
                    <button
                      type="button"
                      onClick={() => openAssignForm(option)}
                      className="text-accent-text hover:underline"
                    >
                      {option.label}
                    </button>
                  </span>
                  <span role="cell">
                    <Pill tone="pending">Sin coordenadas</Pill>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {form && (
        <SiteFlyout
          key={form.znunyKey}
          form={form}
          onChange={setForm}
          onClose={() => setForm(null)}
          onSubmit={handleSubmit}
          error={formError}
          saving={saving}
        />
      )}
    </div>
  );
}
