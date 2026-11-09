export type AdminNavIcon = "home" | "users" | "sites" | "queues" | "status";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: AdminNavIcon;
}

export interface AdminNavGroup {
  group: string | null;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { group: null, items: [{ to: "/admin", label: "Inicio", icon: "home" }] },
  {
    group: "Gestión",
    items: [
      { to: "/admin/users", label: "Usuarios", icon: "users" },
      { to: "/admin/sites", label: "Sitios", icon: "sites" },
      { to: "/admin/queues", label: "Colas", icon: "queues" },
    ],
  },
  { group: "Sistema", items: [{ to: "/admin/status", label: "Estado de conexión", icon: "status" }] },
];
