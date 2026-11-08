import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Catalog } from "../types";
import { QUEUE_SEPARATOR } from "../lib/queueFilter";

type QueueOption = Catalog["queues"][number];

interface BaseProps {
  queues: QueueOption[];
  className?: string;
  placeholder?: string;
}

type QueueTreeSelectProps =
  | (BaseProps & { multiple?: false; value: string | null; onChange: (value: string | null) => void })
  | (BaseProps & { multiple: true; value: string[]; onChange: (value: string[]) => void });

/** Colas válidas ordenadas por nombre completo: cada padre queda justo antes de sus subcolas. */
function buildTree(queues: QueueOption[]) {
  return queues
    .filter((q) => q.valid)
    .map((q) => {
      const parts = q.name.split(QUEUE_SEPARATOR);
      return { name: q.name, label: parts[parts.length - 1], depth: parts.length - 1 };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Selector de colas en árbol (indentado por jerarquía "A::B"). En modo
 * simple, elegir una cola incluye sus subcolas al filtrar (ver
 * matchesQueueFilter); en modo `multiple` es una lista de casillas.
 */
export function QueueTreeSelect(props: QueueTreeSelectProps) {
  const { queues, className = "", placeholder = "Todas las colas" } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => buildTree(queues), [queues]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selected: string[] = props.multiple ? props.value : props.value ? [props.value] : [];
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].split(QUEUE_SEPARATOR).slice(-1)[0]
        : `${selected.length} colas`;

  const toggle = (name: string) => {
    if (props.multiple) {
      props.onChange(props.value.includes(name) ? props.value.filter((n) => n !== name) : [...props.value, name]);
    } else {
      props.onChange(props.value === name ? null : name);
      setOpen(false);
    }
  };

  const clear = () => {
    if (props.multiple) props.onChange([]);
    else props.onChange(null);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-[color:var(--glass-border)] bg-[#0b1220] px-2 py-1 text-left text-xs text-[color:var(--text)] outline-none focus:border-[color:var(--cyan)]"
        title={selected.join(", ") || undefined}
      >
        <span className="truncate">{summary}</span>
        <IconChevronDown size={12} stroke={2} className="flex-shrink-0 text-[color:var(--muted)]" />
      </button>
      {open && (
        <div
          role="listbox"
          className="thin-scroll absolute left-0 top-full z-50 mt-1 max-h-64 min-w-full overflow-y-auto rounded-md border border-[color:var(--glass-border)] bg-[#0b1220] py-1 shadow-2xl"
        >
          <button
            type="button"
            onClick={clear}
            className="block w-full px-2 py-1 text-left text-xs text-[color:var(--muted)] hover:bg-white/[0.06]"
          >
            {placeholder}
          </button>
          {tree.map((q) => {
            const checked = selected.includes(q.name);
            return (
              <button
                key={q.name}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(q.name)}
                className={`flex w-full items-center gap-1.5 whitespace-nowrap py-1 pr-2 text-left text-xs hover:bg-white/[0.06] ${
                  checked ? "text-[color:var(--cyan)]" : "text-[color:var(--text)]"
                }`}
                style={{ paddingLeft: 8 + q.depth * 12 }}
              >
                {props.multiple && <input type="checkbox" readOnly checked={checked} className="pointer-events-none" />}
                {q.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
