import {
  Icon,
  IconBoxMultiple,
  IconBuilding,
  IconChartBar,
  IconCpu,
  IconHeadset,
  IconNut,
  IconTool,
  IconVideo,
  IconWifi,
} from "@tabler/icons-react";

/**
 * Mapeo fijo departamento → ícono (Tabler Icons). Centralizado acá para
 * reutilizarse tanto en el marcador compuesto del mapa como en la tabla de
 * tickets, el panel de detalle, filtros, etc.
 */
export const DEPARTMENT_ICON_MAP: Record<string, Icon> = {
  CCTV: IconVideo,
  Mantenimiento: IconTool,
  Operaciones: IconNut,
  "Proveedor Externo": IconBoxMultiple,
  Redes: IconWifi,
  Soporte: IconHeadset,
  Ventas: IconChartBar,
  Tecnología: IconCpu,
};

const FALLBACK_ICON: Icon = IconBuilding;

export function getDepartmentIcon(department: string | undefined): Icon {
  return (department && DEPARTMENT_ICON_MAP[department]) || FALLBACK_ICON;
}

interface DepartmentIconProps {
  department: string | undefined;
  size?: number;
  className?: string;
}

/** Ícono de departamento listo para usar en componentes React (tabla, drawer, filtros). */
export function DepartmentIcon({ department, size = 14, className }: DepartmentIconProps) {
  const IconComponent = getDepartmentIcon(department);
  return <IconComponent size={size} stroke={2} className={className} />;
}
