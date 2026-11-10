interface TicketTitleLinkProps {
  title: string;
  href?: string;
  className?: string;
}

/**
 * Título del ticket como hipervínculo a la Mesa de Servicio (pestaña nueva).
 * Sin URL se muestra como texto plano. Detiene la propagación del clic para
 * no disparar la selección de la fila/tarjeta que lo contiene.
 */
export function TicketTitleLink({ title, href, className = "" }: TicketTitleLinkProps) {
  if (!href) return <span className={className}>{title}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir en la Mesa de Servicio"
      onClick={(e) => e.stopPropagation()}
      className={`decoration-accent-text underline-offset-2 hover:text-accent-text hover:underline ${className}`}
    >
      {title}
    </a>
  );
}
