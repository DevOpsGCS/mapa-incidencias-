export type ColumnId =
  | "tn"
  | "title"
  | "queue"
  | "priority"
  | "state"
  | "owner"
  | "site"
  | "sla"
  | "created"
  | "type"
  | "service"
  | "responsible"
  | "customer";

export const DEFAULT_COLUMNS: ColumnId[] = ["tn", "title", "queue", "priority", "state", "owner", "site", "sla", "created"];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  tn: "Nº",
  title: "Título",
  queue: "Cola",
  priority: "Prioridad",
  state: "Estado",
  owner: "Propietario",
  site: "Sitio",
  sla: "SLA",
  created: "Creado",
  type: "Tipo",
  service: "Servicio",
  responsible: "Responsable",
  customer: "Cliente",
};

/** Orden canónico de las columnas (el de COLUMN_LABELS). */
export const ALL_COLUMNS = Object.keys(COLUMN_LABELS) as ColumnId[];

export const COLUMNS_STORAGE_KEY = "metrics.columns.v1";

function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && value in COLUMN_LABELS;
}

/** Lee las columnas guardadas; ante cualquier fallo devuelve DEFAULT_COLUMNS. */
export function loadColumns(storage: Pick<Storage, "getItem"> | null): ColumnId[] {
  try {
    if (!storage) return DEFAULT_COLUMNS;
    const raw = storage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS;
    const cols = parsed.filter(isColumnId);
    if (cols.length === 0) return DEFAULT_COLUMNS;
    // El título siempre se muestra: es la columna que da sentido a la fila.
    return cols.includes("title") ? cols : [cols[0], "title", ...cols.slice(1)];
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export function saveColumns(storage: Pick<Storage, "setItem"> | null, cols: ColumnId[]): void {
  try {
    storage?.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(cols));
  } catch {
    // Almacenamiento no disponible (modo privado, TV): la elección vale solo para la sesión.
  }
}
