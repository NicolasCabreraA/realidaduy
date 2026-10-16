import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { Category } from "@/lib/types";
import type { MetricSummary, TerritorySummary } from "@/lib/data/summaries";
import TableWrap from "@/components/ui/TableWrap";

// Vista general del comparador: todos los indicadores a la vez, una columna por
// territorio (idea tomada del comparador de prestadores de AtuServicio.uy).
// Las filas se agrupan por tema en el mismo orden que /indicadores.

const GROUPS: { id: Category; label: string }[] = [
  { id: "poblacion", label: "Población y gobierno" },
  { id: "trabajo", label: "Trabajo" },
  { id: "economia", label: "Economía" },
  { id: "sociedad", label: "Sociedad" },
  { id: "seguridad", label: "Seguridad" },
];

// Unidades largas ("cada 100 mil") van una vez en la fila y no en cada celda:
// así la celda queda en un renglón aun en el celular.
const unitInRow = (unit: string) => unit.includes(" ");
const UNIT_LABEL: Record<string, string> = { "cada 100 mil": "cada 100 mil hab." };

function territoryHref(t: TerritorySummary): string {
  return t.level === "departamento" ? `/departamentos/${t.slug}` : "/montevideo/municipios";
}

export default function CompareOverview({ territories }: { territories: TerritorySummary[] }) {
  // Filas: la unión de los indicadores con dato en algún territorio, en el orden
  // del diccionario (el de summaries).
  const rows = new Map<string, MetricSummary>();
  for (const t of territories) {
    for (const m of t.metrics) if (!rows.has(m.indicatorId)) rows.set(m.indicatorId, m);
  }
  const hasGov = territories.some((t) => t.gov);

  return (
    <TableWrap label="Comparación de todos los indicadores" className="compare-overview">
      <table className="tabla">
        <caption className="sr-only">
          Todos los indicadores de {territories.map((t) => t.name).join(", ")}, lado a lado
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky-col">
              Indicador
            </th>
            {territories.map((t) => (
              <th key={t.id} scope="col" className="num territory-col">
                <Link href={territoryHref(t)} className="territory-name hover:text-primary hover:underline">
                  {t.name}
                </Link>
                <span className="territory-level">
                  {t.level === "departamento" ? "Departamento" : "Municipio de Montevideo"}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {GROUPS.map((g) => {
          const metrics = [...rows.values()].filter((m) => m.category === g.id);
          const showGov = g.id === "poblacion" && hasGov;
          if (metrics.length === 0 && !showGov) return null;
          return (
            <tbody key={g.id}>
              <tr className="group-row">
                <th scope="colgroup" colSpan={territories.length + 1}>
                  <span className="group-label">{g.label}</span>
                </th>
              </tr>
              {metrics.map((meta) => {
                const cells = territories.map((t) =>
                  t.metrics.find((m) => m.indicatorId === meta.indicatorId)
                );
                const present = cells.filter((c): c is MetricSummary => Boolean(c));
                // Período y fuente en la fila si son iguales para todos; si no, en cada celda.
                const sameContext = present.every(
                  (c) => c.periodLabel === present[0].periodLabel && c.sourceShort === present[0].sourceShort
                );
                const max = Math.max(...present.map((c) => c.value), 0);
                const rowUnit = unitInRow(meta.unit) ? (UNIT_LABEL[meta.unit] ?? meta.unit) : null;
                return (
                  <tr key={meta.indicatorId}>
                    <th scope="row" className="sticky-col">
                      <Link href={`/indicadores/${meta.slug}`} className="row-name hover:text-primary hover:underline">
                        {meta.name}
                      </Link>
                      {rowUnit ? <span className="row-context">{rowUnit}</span> : null}
                      {sameContext && present[0] ? (
                        <span className="row-context">
                          {present[0].periodLabel} · {present[0].sourceShort}
                        </span>
                      ) : null}
                    </th>
                    {cells.map((c, i) =>
                      c ? (
                        <td key={territories[i].id} className="num">
                          <span className="cell-value">
                            {rowUnit ? formatNumber(c.value, c.decimals) : c.display}
                          </span>
                          {max > 0 && c.value >= 0 ? (
                            <span aria-hidden className="cell-bar">
                              <span style={{ width: `${Math.max((c.value / max) * 100, 2)}%` }} />
                            </span>
                          ) : null}
                          {!sameContext ? (
                            <span className="row-context">
                              {c.periodLabel} · {c.sourceShort}
                            </span>
                          ) : null}
                        </td>
                      ) : (
                        <td key={territories[i].id} className="num cell-empty">
                          Sin dato
                        </td>
                      )
                    )}
                  </tr>
                );
              })}
              {showGov ? (
                <tr>
                  <th scope="row" className="sticky-col">
                    <span className="row-name">Partido que gobierna</span>
                    <span className="row-context">Elecciones 2025 · Corte Electoral</span>
                  </th>
                  {territories.map((t) =>
                    t.gov ? (
                      <td key={t.id} className="num">
                        <span className="cell-value inline-flex items-center gap-1.5">
                          <span aria-hidden className="party-dot" style={{ background: t.gov.color }} />
                          {t.gov.partyShort}
                        </span>
                        {t.gov.electedName ? <span className="row-context">{t.gov.electedName}</span> : null}
                        {t.gov.demo ? (
                          <span className="row-context text-demo-ink">Pendiente de validación</span>
                        ) : null}
                      </td>
                    ) : (
                      <td key={t.id} className="num cell-empty">
                        Sin dato
                      </td>
                    )
                  )}
                </tr>
              ) : null}
            </tbody>
          );
        })}
      </table>
    </TableWrap>
  );
}
