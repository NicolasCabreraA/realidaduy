import type { Indicator } from "@/lib/types";
import { formatDelta } from "@/lib/format";

/**
 * Variación con flecha + texto (nunca solo color). El color se aplica
 * únicamente si el indicador tiene lectura consensuada.
 */
export default function Delta({
  delta,
  indicator,
  prevLabel,
}: {
  delta: number;
  indicator: Indicator;
  prevLabel?: string;
}) {
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  let color = "text-ink-soft";
  if (indicator.reading === "lowerIsBetter") {
    color = direction === "down" ? "text-up" : direction === "up" ? "text-down" : "text-ink-soft";
  } else if (indicator.reading === "higherIsBetter") {
    color = direction === "up" ? "text-up" : direction === "down" ? "text-down" : "text-ink-soft";
  }
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  // Lo que el color dice (mejora o empeora), también en texto para lectores de pantalla.
  const reading =
    color === "text-up" ? "mejora" : color === "text-down" ? "empeora" : null;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${color}`}>
      <span aria-hidden>{arrow}</span>
      <span className="tnum">{formatDelta(delta, indicator.unit, indicator.decimals)}</span>
      {reading ? <span className="sr-only">({reading})</span> : null}
      {prevLabel ? <span className="font-normal text-ink-faint">vs {prevLabel}</span> : null}
    </span>
  );
}
