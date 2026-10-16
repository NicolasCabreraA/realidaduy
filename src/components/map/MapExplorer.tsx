"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import ChoroplethMap, { type MapEntry } from "@/components/map/ChoroplethMap";
import { CategoricalLegend, SequentialLegend } from "@/components/map/MapLegend";
import ShareButton from "@/components/share/ShareButton";
import { PartyBadge } from "@/components/ui/Badge";
import TableWrap from "@/components/ui/TableWrap";
import { quantileScale } from "@/lib/scale";
import { legendFormat } from "@/lib/format";
import { CATALOGO_NACIONAL, CONJUNTO_ELECCIONES_2025 } from "@/data/catalogo";
import type { MetricSummary, TerritorySummary } from "@/lib/data/summaries";

export default function MapExplorer({
  territories,
  geoUrl,
  backdropUrl,
  profileBase,
  mapTitle,
  defaultMode = "poblacion",
  showCodes = true,
}: {
  territories: TerritorySummary[];
  geoUrl: string;
  /** Capa de contexto no interactiva bajo el mapa (ver ChoroplethMap). */
  backdropUrl?: string;
  /** Base del enlace "Ver perfil completo" (null = sin perfil individual). */
  profileBase: string | null;
  mapTitle: string;
  defaultMode?: string;
  showCodes?: boolean;
}) {
  // Modos disponibles: cada indicador con datos en ≥1 territorio + partido de gobierno.
  const metricModes = useMemo(() => {
    const seen = new Map<string, MetricSummary>();
    for (const t of territories) {
      for (const m of t.metrics) {
        if (!seen.has(m.indicatorId)) seen.set(m.indicatorId, m);
      }
    }
    return [...seen.values()];
  }, [territories]);

  const [mode, setMode] = useState<string>(defaultMode);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const byId = useMemo(
    () => Object.fromEntries(territories.map((t) => [t.id, t])),
    [territories]
  );

  const activeMetric = metricModes.find((m) => m.indicatorId === mode);

  // Un mismo indicador puede venir de más de un origen según el territorio
  // (p. ej. población municipal: OPP en el interior, INE en Montevideo).
  const activeSources = useMemo(() => {
    if (!activeMetric) return [];
    const seen = new Map<string, MetricSummary>();
    for (const t of territories) {
      const m = t.metrics.find((x) => x.indicatorId === activeMetric.indicatorId);
      if (m && !seen.has(m.sourceHref)) seen.set(m.sourceHref, m);
    }
    return [...seen.values()];
  }, [territories, activeMetric]);

  const scale = useMemo(() => {
    if (!activeMetric) return null;
    const values = territories
      .map((t) => t.metrics.find((m) => m.indicatorId === activeMetric.indicatorId)?.value)
      .filter((v): v is number => v !== undefined);
    if (values.length < 2) return null;
    return quantileScale(values);
  }, [territories, activeMetric]);

  const entries = useMemo(() => {
    const out: Record<string, MapEntry> = {};
    for (const t of territories) {
      if (mode === "gobierno") {
        out[t.id] = {
          fill: t.gov?.color ?? "var(--color-line)",
          label: t.name,
          sublabel: t.gov ? `Gobierno: ${t.gov.partyName}` : "Sin datos",
        };
      } else {
        const metric = t.metrics.find((m) => m.indicatorId === mode);
        out[t.id] = {
          fill: metric && scale ? scale.fillFor(metric.value) : "var(--color-line)",
          label: t.name,
          sublabel: metric ? `${metric.display} (${metric.periodLabel})` : "Sin datos",
        };
      }
    }
    return out;
  }, [territories, mode, scale]);

  const partiesInMap = useMemo(() => {
    const seen = new Map<string, { color: string; label: string }>();
    for (const t of territories) {
      if (t.gov && !seen.has(t.gov.partyId)) {
        seen.set(t.gov.partyId, { color: t.gov.color, label: t.gov.partyName });
      }
    }
    return [...seen.values()];
  }, [territories]);

  const selected = selectedId ? byId[selectedId] : null;

  // Lo mismo que muestra el mapa, en texto: el color no puede ser la única
  // forma de leer el dato (WCAG 1.4.1 y 1.1.1). De mayor a menor.
  const tableRows = useMemo(() => {
    if (mode === "gobierno") {
      return territories
        .map((t) => ({
          id: t.id,
          name: t.name,
          cells: [t.gov?.partyName ?? "Sin datos", t.gov?.electedName ?? "—"],
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    return territories
      .map((t) => ({ t, m: t.metrics.find((x) => x.indicatorId === mode) }))
      .sort((a, b) => (b.m?.value ?? -Infinity) - (a.m?.value ?? -Infinity))
      .map(({ t, m }) => ({
        id: t.id,
        name: t.name,
        cells: [m?.display ?? "Sin datos", m?.periodLabel ?? "—"],
      }));
  }, [territories, mode]);
  const tableHead =
    mode === "gobierno"
      ? ["Partido de gobierno", territories[0]?.level === "municipio" ? "Alcalde/sa" : "Intendente/a"]
      : [activeMetric?.name ?? "Valor", "Período"];
  const levelName = territories[0]?.level === "municipio" ? "Municipio" : "Departamento";

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
      <div className="min-w-0">
        <div
          role="group"
          aria-label="Elegir qué mostrar en el mapa"
          className="flex w-full flex-wrap gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-card"
        >
          {[
            ...metricModes.map((m) => [m.indicatorId, m.mapLabel] as const),
            ["gobierno", "Gobierno"] as const,
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`pressable relative shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                mode === value ? "text-white" : "text-ink-soft hover:text-primary"
              }`}
            >
              {mode === value ? (
                <motion.span
                  layoutId="modo-mapa-activo"
                  aria-hidden
                  className="absolute inset-0 rounded-lg bg-primary"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: "spring", duration: 0.45, bounce: 0.15 }
                  }
                />
              ) : null}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

        <div data-share-card className="mt-3">
          <div data-no-export className="flex justify-end">
            <ShareButton
              filename={`mapa-${mode}`}
              title={
                activeMetric
                  ? `${activeMetric.name} (${activeMetric.periodLabel})`
                  : "Partido de gobierno (2025)"
              }
            />
          </div>
          <p hidden data-export-only className="font-display text-xl font-bold text-ink">
            {activeMetric
              ? `${activeMetric.name} · ${activeMetric.periodLabel}`
              : "Partido de gobierno (2025)"}
          </p>
          <p hidden data-export-only className="mt-0.5 text-sm text-ink-soft">
            {activeMetric
              ? `Fuente: ${activeMetric.sourceShort}`
              : "Fuente: Corte Electoral"}
          </p>
          <div className="mt-2">
            <ChoroplethMap
              geoUrl={geoUrl}
              backdropUrl={backdropUrl}
              entries={entries}
              selectedId={selectedId}
              onSelect={setSelectedId}
              title={mapTitle}
              showCodes={showCodes}
            />
          </div>

          <div className="mt-4">
            {mode === "gobierno" ? (
              <CategoricalLegend items={partiesInMap} title="Partido de gobierno (2025)" />
            ) : activeMetric && scale ? (
              <SequentialLegend
                breaks={scale.breaks}
                format={legendFormat(activeMetric.unit, activeMetric.decimals)}
                title={`${activeMetric.name} · ${activeMetric.periodLabel}`}
              />
            ) : null}
            <p data-no-export className="mt-2 text-xs text-ink-faint">
              Fuente:{" "}
              {activeMetric ? (
                activeSources.map((m, i) => (
                  <span key={m.sourceHref}>
                    {i > 0 ? " · " : null}
                    <a
                      className="underline decoration-line underline-offset-2 hover:decoration-primary"
                      href={m.sourceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {m.datasetTitle
                        ? `${m.sourceShort}, conjunto «${m.datasetTitle}» del ${CATALOGO_NACIONAL.name}`
                        : `${m.sourceShort} (ver el dato)`}
                    </a>
                  </span>
                ))
              ) : (
                <a
                  className="underline decoration-line underline-offset-2 hover:decoration-primary"
                  href={CONJUNTO_ELECCIONES_2025}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {`Corte Electoral, conjunto «Elecciones Departamentales y Municipales 2025» del ${CATALOGO_NACIONAL.name}`}
                </a>
              )}
            </p>
          </div>
        </div>
        <details data-no-export className="fold mt-3">
          <summary className="pressable inline-block rounded-lg text-sm font-semibold text-primary">
            Ver los datos del mapa en una tabla
          </summary>
          <TableWrap label={`Datos del mapa: ${tableHead[0]}`} className="mt-2">
            <table className="tabla min-w-[320px]">
              <caption className="sr-only">
                {mode === "gobierno"
                  ? "Partido de gobierno de cada territorio del mapa"
                  : `${activeMetric?.name ?? ""} en cada territorio del mapa, de mayor a menor`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{levelName}</th>
                  {tableHead.map((h) => (
                    <th key={h} scope="col" className={mode === "gobierno" ? undefined : "num"}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row" className="text-left font-semibold">
                      {r.name}
                    </th>
                    {r.cells.map((c, j) => (
                      <td key={j} className={mode === "gobierno" ? undefined : "num"}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </details>
        <p className="mt-3 text-xs text-ink-faint">
          Con teclado: Tab recorre los territorios, Enter o Espacio selecciona y Escape
          cierra el cartel. El enlace «Saltar el mapa» aparece al empezar.
        </p>
      </div>

      {selected ? (
        <motion.aside
          key={selected.id}
          initial={reduce ? false : { opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          aria-label={`Detalle de ${selected.name}`}
          className="fixed inset-x-0 bottom-14 z-30 max-h-[55dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-5 shadow-overlay md:bottom-0 lg:static lg:z-auto lg:mt-12 lg:max-h-none lg:rounded-2xl lg:border lg:shadow-card"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-bold">{selected.name}</h2>
              {selected.capital ? (
                <p className="text-sm text-ink-faint">Capital: {selected.capital}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Cerrar detalle"
              className="rounded-lg border border-line px-2.5 py-1 text-sm font-bold text-ink-soft hover:bg-primary-soft"
            >
              ✕
            </button>
          </div>

          <dl className="mt-4 space-y-3.5 text-sm">
            <div>
              <dt className="font-bold text-ink-faint">
                {selected.level === "municipio" ? "Alcalde/sa" : "Gobierno departamental"}
              </dt>
              <dd className="mt-1">
                {selected.gov ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <PartyBadge color={selected.gov.color} name={selected.gov.partyName} />
                    {selected.gov.electedName ? (
                      <span className="font-semibold">{selected.gov.electedName}</span>
                    ) : null}
                  </div>
                ) : (
                  "Sin datos"
                )}
              </dd>
            </div>
            {selected.metrics.map((m) => (
              <div key={m.indicatorId} className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="text-ink-soft">{m.name}</dt>
                <dd className="text-right">
                  <span className="tnum font-bold text-ink">{m.display}</span>{" "}
                  <span className="block text-xs text-ink-faint">
                    {m.periodLabel} · {m.sourceShort}
                  </span>
                </dd>
              </div>
            ))}
            {selected.level === "municipio" ? (
              <div className="border-t border-line pt-3 text-xs text-ink-faint">
                Los indicadores de la ECH (empleo, ingreso, pobreza) existen a nivel
                departamental, no municipal.
              </div>
            ) : null}
          </dl>

          {profileBase ? (
            <Link
              href={`${profileBase}/${selected.slug}`}
              className="pressable mt-5 inline-block rounded-lg bg-primary px-4 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Ver perfil completo →
            </Link>
          ) : null}
        </motion.aside>
      ) : (
        <aside className="hidden lg:mt-12 lg:block">
          <div className="rounded-2xl border border-dashed border-line bg-surface p-5 text-sm text-ink-soft">
            Seleccioná un territorio en el mapa para ver su resumen.
          </div>
        </aside>
      )}
    </div>
  );
}
