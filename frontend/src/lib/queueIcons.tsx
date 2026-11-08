import {
  Icon,
  IconBuilding,
  IconDeviceCctv,
  IconHeadset,
  IconCpu,
  IconTool,
  IconVideo,
} from "@tabler/icons-react";
import { rootQueue } from "./queueFilter";

/**
 * Mapeo cola raíz → ícono (Tabler Icons). Las colas son dinámicas (vienen de
 * Znuny): solo las raíces conocidas tienen ícono propio, el resto usa uno genérico.
 */
export const QUEUE_ICON_MAP: Record<string, Icon> = {
  Tecnología: IconCpu,
  "SINI - Soporte IT": IconHeadset,
  "SINI - Mantenimiento": IconTool,
  CCTV: IconDeviceCctv,
  BodyCams: IconVideo,
};

const FALLBACK_ICON: Icon = IconBuilding;

export function queueIcon(queue: string | undefined): Icon {
  return (queue && QUEUE_ICON_MAP[rootQueue(queue)]) || FALLBACK_ICON;
}

interface QueueIconProps {
  queue: string | undefined;
  size?: number;
  className?: string;
}

/** Ícono de cola listo para usar en componentes React (tabla, drawer, notificaciones). */
export function QueueIcon({ queue, size = 14, className }: QueueIconProps) {
  const IconComponent = queueIcon(queue);
  return <IconComponent size={size} stroke={2} className={className} />;
}
