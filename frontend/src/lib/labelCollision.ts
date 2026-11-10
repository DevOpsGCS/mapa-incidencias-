/**
 * Elige qué etiquetas de sitio mostrar para que no se encimen (p. ej. los tres
 * sitios del aeropuerto, a menos de 1 km entre sí, a zoom de país).
 *
 * Algoritmo voraz: se recorren las etiquetas de mayor a menor prioridad y se
 * conserva cada una cuyo rectángulo no choque con las ya conservadas. El ancho
 * se estima por cantidad de caracteres (no hay DOM: función pura y testeable).
 */
export interface LabelCandidate {
  id: string;
  /** Centro horizontal y borde inferior de la etiqueta, en px de pantalla. */
  x: number;
  y: number;
  text: string;
  /** Mayor = más importante (se conserva primero). */
  priority: number;
}

export interface LabelMetrics {
  charWidth: number;
  padding: number;
  height: number;
  /** Separación mínima entre etiquetas. */
  gap: number;
}

export const DEFAULT_LABEL_METRICS: LabelMetrics = { charWidth: 6.6, padding: 16, height: 18, gap: 4 };

export function pickVisibleLabels(
  candidates: LabelCandidate[],
  scale = 1,
  metrics: LabelMetrics = DEFAULT_LABEL_METRICS
): Set<string> {
  const ordered = candidates
    .map((c, index) => ({ c, index }))
    .sort((a, b) => b.c.priority - a.c.priority || a.index - b.index);

  const kept: { left: number; right: number; top: number; bottom: number }[] = [];
  const visible = new Set<string>();
  const gap = metrics.gap * scale;

  for (const { c } of ordered) {
    const width = (c.text.length * metrics.charWidth + metrics.padding) * scale;
    const rect = {
      left: c.x - width / 2,
      right: c.x + width / 2,
      top: c.y - metrics.height * scale,
      bottom: c.y,
    };
    const collides = kept.some(
      (k) =>
        rect.left < k.right + gap &&
        rect.right + gap > k.left &&
        rect.top < k.bottom + gap &&
        rect.bottom + gap > k.top
    );
    if (!collides) {
      kept.push(rect);
      visible.add(c.id);
    }
  }
  return visible;
}
