"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ShareButton from "@/components/share/ShareButton";
import CompareOverview from "@/components/compare/CompareOverview";
import { formatNumber } from "@/lib/format";
import type { MetricSummary, TerritorySummary } from "@/lib/data/summaries";
import TableWrap from "@/components/ui/TableWrap";

const EMPTY = "";

type View = "general" | "indicador";
const VIEWS: { id: View; label: string }[] = [
  { id: "general", label: "Vista general" },
  { id: "indicador", label: "Un indicador" },
];

export default function CompareTool({
  territories,
  initial,
}: {
  territories: TerritorySummary[];
  initial: string[];
}) {
  const [picks, setPicks] = useState<string[]>([
    initial[0] ?? EMPTY,
    initial[1] ?? EMPTY,
    initial[2] ?? EMPTY,
  ]);

  const bySlug = useMemo(
    () => Object.fromEntries(territories.map((t) => [t.slug + "|" + t.level, t])),
    [territories]
  );
  const departments = territories.filter((t) => t.level === "departamento");
  const municipios = territories.filter((t) => t.level === "municipio");

  // Indicadores comparables: los que existen en al menos un territorio.
  const indicatorOptions = useMemo(() => {
    const seen = new Map<string, MetricSummary>();
    for (const t of territories) {
      for (const m of t.metrics) {
        if (!seen.has(m.indicatorId)) seen.set(m.indicatorId, m);
      }
    }
    return [...seen.values()];
  }, [territories]);

  const [indicatorId, setIndicatorId] = useState("poblacion");
  const [view, setView] = useState<View>("general");
  const meta =
    indicatorOptions.find((m) => m.indicatorId === indicatorId) ?? indicatorOptions[0];

  const chosen = picks
    .filter((p) => p !== EMPTY)
    .map((p) => bySlug[p])
    .filter((t): t is TerritorySummary => Boolean(t));

  const rows = chosen.map((t) => ({
    territory: t,
    metric: t.metrics.find((m) => m.indicatorId === meta?.indicatorId),
  }));
  const withData = rows.filter((r) => r.metric);
  const max = Math.max(...withData.map((r) => r.metric!.value), 1);
  const base = withData[0];

  const update = (index: number, value: string) => {
    setPicks((prev) => prev.map((p, i) => (i === index ? value : p)));
  };

  // Pestañas accesibles: flechas izquierda/derecha cambian de vista.
  const onTabKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = view === "general" ? "indicador" : "general";
    setView(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <div>
      <fieldset className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <legend className="px-1 font-display text-sm font-bold text-ink-soft">
          Elegí hasta 3 territorios
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <label key={i} className="block min-w-0 text-sm">
              <span className="font-semibold text-ink-soft">
                Territorio {i + 1}
                {i === 2 ? " (opcional)" : ""}
              </span>
              <select
                value={picks[i]}
                onChange={(e) => update(i, e.target.value)}
                className="mt-1 w-full min-w-0 rounded-lg border border-control-line bg-surface px-3 py-2.5 text-base"
              >
                <option value={EMPTY}>— Elegir —</option>
                <optgroup label="Departamentos">
                  {departments.map((t) => (
                    <option key={t.id} value={t.slug + "|departamento"}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Municipios de Montevideo">
                  {municipios.map((t) => (
                    <option key={t.id} value={t.slug + "|municipio"}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          ))}
        </div>
        {view === "indicador" ? (
          <label className="mt-3 block text-sm">
            <span className="font-semibold text-ink-soft">Indicador</span>
            <select
              value={meta?.indicatorId ?? ""}
              onChange={(e) => setIndicatorId(e.target.value)}
              className="mt-1 w-full min-w-0 rounded-lg border border-control-line bg-surface px-3 py-2.5 text-base sm:max-w-sm"
            >
              {indicatorOptions.map((m) => (
                <option key={m.indicatorId} value={m.indicatorId}>
                  {m.name} · {m.periodLabel}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </fieldset>

      <div
        role="tablist"
        aria-label="Forma de comparar"
        className="mt-6 inline-flex rounded-xl border border-line bg-surface p-1"
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            id={`tab-${v.id}`}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            aria-controls="compare-panel"
            tabIndex={view === v.id ? 0 : -1}
            onClick={() => setView(v.id)}
            onKeyDown={onTabKey}
            className={`pressable rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              view === v.id ? "bg-primary text-white" : "text-ink-soft hover:text-primary"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {chosen.length >= 2 ? `Comparando ${chosen.map((t) => t.name).join(", ")}` : ""}
      </p>

      <div id="compare-panel" role="tabpanel" aria-labelledby={`tab-${view}`} className="mt-4">
        {chosen.length < 2 || !meta ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-ink-soft">
            Elegí al menos dos territorios para comparar.
          </div>
        ) : view === "general" ? (
          <div>
            <CompareOverview territories={chosen} />
            <p className="mt-3 text-xs text-ink-faint">
              Cada fila muestra el último dato disponible de cada territorio, con su período y
              su fuente. La barra indica el tamaño relativo dentro de la fila. Para el detalle de
              un indicador, con diferencias y la imagen para compartir, usá «Un indicador».
            </p>
          </div>
        ) : (
          <figure data-share-card className="rounded-2xl border border-line bg-surface p-4 shadow-card md:p-5">
            <div className="flex items-start justify-between gap-3">
              <figcaption className="min-w-0">
                <h2 className="font-display text-lg font-bold md:text-xl">{meta.name}</h2>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {meta.periodLabel} · {meta.sourceShort}
                </p>
              </figcaption>
              <ShareButton
                filename={`comparacion-${meta.slug}`}
                title={`Comparación: ${meta.name}`}
              />
            </div>
            <div className="mt-4 space-y-2">
              {rows.map(({ territory, metric }) => (
                <div
                  key={territory.id}
                  className="grid grid-cols-[8rem_1fr_auto] items-center gap-2 text-sm sm:grid-cols-[11rem_1fr_auto]"
                >
                  <span className="truncate font-semibold">{territory.name}</span>
                  {metric ? (
                    <>
                      <span aria-hidden className="h-5 overflow-hidden rounded-r-sm bg-primary-soft">
                        <span
                          className="block h-full rounded-r-sm bg-primary"
                          style={{ width: `${Math.max((metric.value / max) * 100, 2)}%` }}
                        />
                      </span>
                      <span className="tnum font-bold">{metric.display}</span>
                    </>
                  ) : (
                    <span className="col-span-2 text-ink-faint">
                      Sin datos para este nivel territorial
                    </span>
                  )}
                </div>
              ))}
            </div>

            {withData.length >= 2 && base ? (
              <TableWrap label={`Comparación de ${meta.name}`} className="mt-5">
                <table className="tabla min-w-[420px]">
                  <caption className="sr-only">
                    Comparación de {meta.name} entre los territorios elegidos
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Territorio</th>
                      <th scope="col" className="num">{meta.name}</th>
                      <th scope="col" className="num">Diferencia vs {base.territory.name}</th>
                      <th scope="col" className="num">Diferencia %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withData.map(({ territory, metric }, i) => {
                      const diff = metric!.value - base.metric!.value;
                      const pct = (diff / base.metric!.value) * 100;
                      const diffDisplay =
                        meta.unit === "%"
                          ? `${formatNumber(Math.abs(diff), 1)} pp`
                          : formatNumber(Math.abs(diff), meta.decimals);
                      return (
                        <tr key={territory.id}>
                          <td>{territory.name}</td>
                          <td className="num">{metric!.display}</td>
                          <td className="num">
                            {i === 0 ? "—" : `${diff > 0 ? "+" : "−"}${diffDisplay}`}
                          </td>
                          <td className="num">
                            {i === 0 ? "—" : `${pct > 0 ? "+" : "−"}${formatNumber(Math.abs(pct), 1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            ) : null}
            <p className="mt-3 text-xs text-ink-faint">
              Fuente: {meta.sourceShort} · {meta.periodLabel}. Metodología y definición en{" "}
              <Link className="font-semibold text-primary hover:underline" href={`/indicadores/${meta.slug}`}>
                la página del indicador
              </Link>
              .
            </p>
          </figure>
        )}
      </div>
    </div>
  );
}
