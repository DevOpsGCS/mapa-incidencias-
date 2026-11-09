import { IconX } from "@tabler/icons-react";
import { ReactNode, useEffect } from "react";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  width?: number;
  /** Etiqueta accesible del panel. */
  label?: string;
  children: ReactNode;
}

/** Panel fijo a la derecha; se cierra con Esc o con la ×. */
export function SidePanel({ open, onClose, width = 440, label = "Detalle del ticket", children }: SidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <aside
      className="fixed bottom-0 right-0 top-0 z-40 flex max-w-full flex-col border-l border-line-strong bg-surface-1"
      style={{ width, boxShadow: "-20px 0 40px rgba(0,0,0,.5)" }}
      aria-label={label}
    >
      <div className="flex justify-end p-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text-strong"
        >
          <IconX size={18} stroke={2} />
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </aside>
  );
}
