import Link from "next/link";
import type { ReactNode } from "react";
import CatalogCredit from "@/components/ui/CatalogCredit";
import type { MetricSummary, TerritorySummary } from "@/lib/data/summaries";

const link = "underline decoration-line underline-offset-2 hover:decoration-primary";

interface Row {
  indicators: { id: string; slug: string; name: string }[];
  /** Cada origen con la cantidad de territorios que cubre en este mapa. */
  sources: { metric: MetricSummary; territories: number }[];
}

/** Indicadores que comparten exactamente los mismos orígenes van en una sola
 * línea (homicidios, rapiñas y hurtos salen del mismo conjunto). */
function rowsFor(territories: TerritorySummary[]): Row[] {
  const byIndicator = new Map<string, Row>();
  for (const t of territories) {
    for (const m of t.metrics) {
      let row = byIndicator.get(m.indicatorId);
      if (!row) {
        row = { indicators: [{ id: m.indicatorId, slug: m.slug, name: m.name }], sources: [] };
        byIndicator.set(m.indicatorId, row);
      }
      const source = row.sources.find((s) => s.metric.sourceHref === m.sourceHref);
      if (source) source.territories++;
      else row.sources.push({ metric: m, territories: 1 });
    }
  }
  const grouped = new Map<string, Row>();
  for (const row of byIndicator.values()) {
    const key = row.sources.map((s) => `${s.metric.sourceHref} ${s.territories}`).join(" ");
    const prev = grouped.get(key);
    if (prev) prev.indicators.push(...row.indicators);
    else grouped.set(key, row);
  }
  return [...grouped.values()];
}

// "Tasa de homicidios, tasa de rapiñas y tasa de hurtos" (sin tocar siglas: "NBI").
function lowerFirst(name: string): string {
  return /^\p{Lu}\p{Ll}/u.test(name) ? name[0].toLowerCase() + name.slice(1) : name;
}

function joinList(items: ReactNode[]): ReactNode[] {
  return items.flatMap((item, i) => {
    if (i === 0) return [item];
    return [i === items.length - 1 ? " y " : ", ", item];
  });
}

/** Fuentes del mapa con enlace directo al dato de cada indicador, más el
 * gobierno y los límites, que cada página describe. */
export default function MapSources({
  territories,
  territoryNoun,
  gobierno,
  limites,
  children,
}: {
  territories: TerritorySummary[];
  /** Para decir cuántos cubre cada origen cuando hay más de uno ("municipios"). */
  territoryNoun: string;
  gobierno: ReactNode;
  limites: ReactNode;
  children?: ReactNode;
}) {
  const rows = rowsFor(territories);
  return (
    <section aria-labelledby="fuentes-mapa" className="mt-8 border-t border-line pt-6">
      <h2 id="fuentes-mapa" className="font-display text-lg font-bold">
        Fuentes de este mapa
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Cada enlace lleva al dato original. El nombre del indicador lleva a su página, con
        la metodología.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
        {rows.map((row) => (
          <li key={row.indicators[0].id}>
            <span className="font-semibold text-ink">
              {joinList(
                row.indicators.map((i, n) => (
                  <Link key={i.id} className={link} href={`/indicadores/${i.slug}`}>
                    {n === 0 ? i.name : lowerFirst(i.name)}
                  </Link>
                ))
              )}
            </span>
            {": "}
            {row.sources.map(({ metric: s, territories: count }, n) => (
              <span key={s.sourceHref}>
                {n > 0 ? "; " : null}
                {s.datasetTitle ? (
                  <CatalogCredit sourceUrl={s.sourceHref} />
                ) : (
                  <a className={link} href={s.sourceHref} target="_blank" rel="noopener noreferrer">
                    {`${s.sourceShort} (ver el dato)`}
                  </a>
                )}
                {row.sources.length > 1 ? ` para ${count} ${territoryNoun}` : null}
              </span>
            ))}
            .
          </li>
        ))}
        <li>
          <span className="font-semibold text-ink">Partido de gobierno</span>: {gobierno}
        </li>
        <li>
          <span className="font-semibold text-ink">Límites</span>: {limites}
        </li>
      </ul>
      {children}
    </section>
  );
}
