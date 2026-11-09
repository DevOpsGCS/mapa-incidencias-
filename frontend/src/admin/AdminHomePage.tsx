import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminStatus, fetchAdminStatus, fetchUnmappedSites, fetchUsers } from "../api/adminClient";
import { ReportCard } from "../components/ReportCard";
import { AdminLayout } from "./AdminLayout";

/** `null` = todavía cargando o no disponible. */
interface HomeData {
  pending: number | null;
  unknownQueues: number | null;
  unmapped: number | null;
  status: AdminStatus | null;
  statusFailed: boolean;
}

function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="block rounded-card transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}

export function AdminHomePage() {
  const [data, setData] = useState<HomeData>({
    pending: null,
    unknownQueues: null,
    unmapped: null,
    status: null,
    statusFailed: false,
  });

  useEffect(() => {
    let alive = true;
    const patch = (p: Partial<HomeData>) => {
      if (alive) setData((d) => ({ ...d, ...p }));
    };
    fetchUsers().then(
      (users) =>
        patch({
          pending: users.filter((u) => u.allowedQueues === null).length,
          unknownQueues: users.filter((u) => (u.unknownQueues?.length ?? 0) > 0).length,
        }),
      () => undefined
    );
    fetchUnmappedSites().then(
      (sites) => patch({ unmapped: sites.length }),
      () => undefined
    );
    fetchAdminStatus().then(
      (status) => patch({ status }),
      () => patch({ statusFailed: true })
    );
    return () => {
      alive = false;
    };
  }, []);

  const show = (n: number | null) => (n === null ? "—" : n);
  const serviceValue = data.status
    ? data.status.serviceDesk.ok
      ? "OK"
      : "Sin conexión"
    : data.statusFailed
      ? "Sin conexión"
      : "—";
  const serviceHint = data.status?.serviceDesk.ok
    ? `Latencia ${data.status.serviceDesk.latencyMs ?? "—"} ms`
    : "Ver detalle de la conexión";

  return (
    <AdminLayout title="Inicio" crumbs={[{ label: "Administración" }, { label: "Inicio" }]}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardLink to="/admin/users?tab=pending">
          <ReportCard
            title="Usuarios pendientes de colas"
            value={show(data.pending)}
            hint="Sin acceso hasta que se les asignen colas"
          />
        </CardLink>
        <CardLink to="/admin/users">
          <ReportCard
            title="Usuarios con colas inexistentes"
            value={show(data.unknownQueues)}
            hint="Tienen colas que ya no existen"
          />
        </CardLink>
        <CardLink to="/admin/sites?tab=unmapped">
          <ReportCard title="Sitios sin configurar" value={show(data.unmapped)} hint="Sin tipo ni coordenadas todavía" />
        </CardLink>
        <CardLink to="/admin/status">
          <ReportCard title="Mesa de Servicio" value={serviceValue} hint={serviceHint} />
        </CardLink>
      </div>
    </AdminLayout>
  );
}
