import type { ReactNode } from "react";
import ShareButton from "@/components/share/ShareButton";
import { toSlug } from "@/lib/format";
import TableWrap from "@/components/ui/TableWrap";

/**
 * Marco estándar de todo gráfico: título-pregunta, fuente, período,
 * "Ver datos" (tabla accesible) y exportación como imagen. Un gráfico
 * nunca se publica suelto.
 */
export default function ChartCard({
  question,
  subtitle,
  sourceLine,
  note,
  table,
  exportName,
  children,
}: {
  question: string;
  subtitle?: string;
  sourceLine: string;
  note?: string;
  table: { caption: string; head: string[]; rows: (string | number)[][] };
  /** Nombre de archivo para la imagen exportada (por defecto, la pregunta). */
  exportName?: string;
  children: ReactNode;
}) {
  return (
    <figure
      data-share-card
      className="rounded-2xl border border-line bg-surface p-4 shadow-card md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <figcaption className="min-w-0">
          <h3 className="font-display text-lg font-bold text-ink md:text-xl">{question}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p> : null}
        </figcaption>
        <ShareButton filename={exportName ?? toSlug(question)} title={question} />
      </div>
      <div className="mt-4">{children}</div>
      <details data-no-export className="fold mt-3">
        <summary className="pressable inline-block rounded-lg text-sm font-semibold text-primary">
          Ver datos
        </summary>
        <TableWrap label={table.caption} className="mt-2">
          <table className="tabla min-w-[320px]">
            <caption className="sr-only">{table.caption}</caption>
            <thead>
              <tr>
                {table.head.map((h, j) => (
                  <th key={h} scope="col" className={j > 0 ? "num" : undefined}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={j > 0 ? "num" : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </details>
      <p className="mt-3 text-xs text-ink-faint">{sourceLine}</p>
      {note ? <p className="mt-1 text-xs text-ink-faint">{note}</p> : null}
    </figure>
  );
}
