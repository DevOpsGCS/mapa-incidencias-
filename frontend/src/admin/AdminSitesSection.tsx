import { IconEdit, IconTrash } from "@tabler/icons-react";
import { FormEvent, useEffect, useState } from "react";
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
import { SITE_TYPE_LABELS } from "../lib/labels";
import { Site, SiteType } from "../types";
import { Badge } from "./Badge";

const SITE_TYPES: SiteType[] = ["aduana_terrestre", "aduana_maritima", "aduana_aerea", "sede"];

interface FormState {
  znunyKey: string;
  /** Nombre visible (etiqueta de Znuny) solo para el título del formulario. */
  label: string;
  type: SiteType;
  lat: string;
  lng: string;
}

export function AdminSitesSection() {
  const { clearSession } = useAuth();
  const [configured, setConfigured] = useState<Site[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedSite[]>([]);
  // clave de Znuny -> nombre visible en vivo (etiqueta de Znuny).
  const [liveNames, setLiveNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
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
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = (site: Site) => (site.znunyKey && liveNames.get(site.znunyKey)) || site.name;

  const openAssignForm = (option: UnmappedSite) => {
    setFormError(null);
    setForm({ znunyKey: option.key, label: option.label, type: "sede", lat: "", lng: "" });
  };

  const openEditForm = (site: Site) => {
    if (!site.znunyKey) return;
    setFormError(null);
    setForm({
      znunyKey: site.znunyKey,
      label: displayName(site),
      type: site.type,
      lat: String(site.lat),
      lng: String(site.lng),
    });
  };

  const closeForm = () => setForm(null);

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
  const handleDelete = async (name: string, label: string) => {
    if (!window.confirm(`¿Quitar coordenadas de "${label}"? El sitio deja de verse en el mapa hasta que se vuelva a configurar.`)) {
      return;
    }
    try {
      await deleteSite(name);
      await load();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearSession();
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo borrar el sitio.");
    }
  };

  if (loading) {
    return <p className="text-sm text-[color:var(--text-secondary)]">Cargando...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-[color:var(--text)]">Sitios</h2>
        <span className="mono-label text-[11px] text-[color:var(--text-secondary)]">
          {configured.length} configurado{configured.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[#FF4D6D]/40 bg-[#2a0f16]/90 px-4 py-2 text-sm text-[#ff8fa3]">
          {error}
        </div>
      )}

      {unmapped.length > 0 && (
        <div
          className="mb-6 rounded-lg border px-4 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--amber) 40%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--amber) 12%, transparent)",
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-base leading-none" style={{ color: "var(--amber)" }}>
              ⚠
            </span>
            <p className="text-sm font-medium" style={{ color: "var(--amber)" }}>
              {unmapped.length} sitio{unmapped.length === 1 ? "" : "s"} sin configurar
            </p>
          </div>
          <ul className="space-y-1.5">
            {unmapped.map((option) => (
              <li
                key={option.key}
                className="flex items-center justify-between gap-2 rounded-md bg-black/10 px-3 py-1.5 text-sm text-[color:var(--text)]"
              >
                <span>{option.label}</span>
                <button
                  type="button"
                  onClick={() => openAssignForm(option)}
                  className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-[color:var(--text)] hover:bg-white/20"
                >
                  Asignar coordenadas
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="mono-label text-[10px] text-[color:var(--text-secondary)]">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Coordenadas</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {configured.map((site) => (
                <tr
                  key={site.id}
                  className="border-t border-[color:var(--glass-border)] transition-colors hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2.5 text-[color:var(--text)]">{displayName(site)}</td>
                  <td className="px-4 py-2.5">
                    <Badge>{SITE_TYPE_LABELS[site.type]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[color:var(--text-secondary)]">
                    {site.lat}, {site.lng}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => openEditForm(site)}
                      disabled={!site.znunyKey}
                      aria-label={`Editar ${displayName(site)}`}
                      title={site.znunyKey ? "Editar" : "Sitio sin clave de Znuny: solo existe en el histórico"}
                      className="mr-2 rounded p-1 text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:text-[color:var(--text-disabled)]"
                    >
                      <IconEdit size={15} stroke={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(site.name, displayName(site))}
                      aria-label={`Borrar ${displayName(site)}`}
                      title="Borrar"
                      className="rounded p-1 text-[color:var(--text-secondary)] transition-colors hover:text-[#FF718A]"
                    >
                      <IconTrash size={15} stroke={2} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleSubmit} className="glass-panel w-full max-w-sm space-y-4 p-6">
            <h3 className="font-display text-base font-semibold text-[color:var(--text)]">
              {form.label}
            </h3>

            <label className="block text-sm text-[color:var(--text-secondary)]">
              Tipo
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as SiteType })}
                className="mt-1 w-full rounded-md border border-[color:var(--glass-border)] bg-[#0b1220] px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
              >
                {SITE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SITE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-3">
              <label className="block flex-1 text-sm text-[color:var(--text-secondary)]">
                Latitud
                <input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  required
                  className="mt-1 w-full rounded-md border border-[color:var(--glass-border)] bg-black/20 px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
                />
              </label>
              <label className="block flex-1 text-sm text-[color:var(--text-secondary)]">
                Longitud
                <input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  required
                  className="mt-1 w-full rounded-md border border-[color:var(--glass-border)] bg-black/20 px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
                />
              </label>
            </div>

            {formError && <p className="text-sm text-[#FF718A]">{formError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md bg-white/5 px-3 py-1.5 text-sm text-[color:var(--text)] hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-[color:var(--text)] hover:bg-white/15 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
