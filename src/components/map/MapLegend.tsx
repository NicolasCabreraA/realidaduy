import { SEQ_COLORS } from "@/lib/scale";

/** Leyenda secuencial: swatches + cortes numéricos. */
export function SequentialLegend({
  breaks,
  format,
  title,
}: {
  breaks: number[];
  format: (v: number) => string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">{title}</p>
      {/* Contorno: el tono más claro casi no se distingue del fondo blanco. */}
      <div className="mt-1 flex w-fit rounded-sm outline outline-1 outline-ink/25" aria-hidden>
        {SEQ_COLORS.map((c) => (
          <span key={c} className="h-3 w-10 first:rounded-l-sm last:rounded-r-sm" style={{ background: c }} />
        ))}
      </div>
      <div className="mt-0.5 flex text-[11px] text-ink-faint" aria-hidden>
        <span className="w-10" />
        {breaks.map((b, i) => (
          <span key={i} className="tnum w-10 -translate-x-1/2 text-center first:translate-x-[-50%]">
            {format(b)}
          </span>
        ))}
      </div>
      <p className="sr-only">
        Escala de menor (claro) a mayor (oscuro). Cortes: {breaks.map(format).join(", ")}.
      </p>
    </div>
  );
}

/** Leyenda categórica (p. ej. partidos): swatch + etiqueta de texto. */
export function CategoricalLegend({
  items,
  title,
}: {
  items: { color: string; label: string }[];
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5 text-sm text-ink">
            <span
              className="h-3 w-3 rounded-sm border border-ink/20"
              style={{ background: item.color }}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
