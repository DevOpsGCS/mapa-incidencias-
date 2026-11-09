import logo from "../img/GCS_logo_nuevo_font_transparente.svg";

interface ServiceDeskLinkProps {
  href: string;
  variant?: "full" | "short";
  className?: string;
}

/** Botón "Abrir en la Mesa de Servicio": píldora azul con el logo de GCS en un círculo blanco. */
export function ServiceDeskLink({ href, variant = "full", className = "" }: ServiceDeskLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir en la Mesa de Servicio"
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-fill text-xs font-medium text-white ${className}`}
      style={{ padding: "5px 12px 5px 5px" }}
    >
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white">
        <img src={logo} alt="" width={14} height={14} style={{ width: 14, height: 14 }} />
      </span>
      {variant === "full" ? "Abrir en la Mesa de Servicio ↗" : "Abrir ↗"}
    </a>
  );
}
