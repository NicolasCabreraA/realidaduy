"use client";

import { useState } from "react";
import Delta from "@/components/charts/Delta";
import { formatNumber, formatValue } from "@/lib/format";
import type { Indicator } from "@/lib/types";
import type { ComparablePeriod, PeriodKind } from "@/lib/data";

// Comparación de dos períodos de la misma granularidad (por ejemplo, el primer
// semestre de 2024 contra el de 2026). Si entre los dos hay un quiebre de
// metodología, muestra los valores pero no la diferencia.

const KIND_LABEL: Record<PeriodKind, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const MESES = /^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Setiembre|Septiembre|Octubre|Noviembre|Diciembre)/;
/**
 * La etiqueta, lista para usarla en medio de una frase: "Agosto 2024" → "agosto
 * 2024", "Año 2024" → "2024", "Desde julio 2026" → "julio 2026",
 * "2025 (promedio anual)" → "2025".
 */
const enFrase = (label: string) =>
  label
    .replace(/^(Desde|Año) /, "")
    .replace(/ \(promedio[^)]*\)$/, "")
    .replace(MESES, (m) => m.toLowerCase());

/** El mismo período n años antes: "2026-S1" → "2024-S1", "2026" → "2024". */
const yearsBefore = (period: string, n: number) => `${Number(period.slice(0, 4)) - n}${period.slice(4)}`;

function magnitude(delta: number, unit: string, decimals: number, from: number): string {
  const n = formatNumber(Math.abs(delta), decimals);
  const rel = from !== 0 ? ` (${formatNumber(Math.abs((delta / from) * 100), 1)}%)` : "";
  if (unit === "%") return `${n} ${Math.abs(delta) === 1 ? "punto" : "puntos"}`;
  if (unit === "pesos") return `$\u00a0${n}${rel}`;
  if (unit === "personas" || unit === "habitantes") return `${n} personas${rel}`;
  return `${n} ${unit}${rel}`;
}

export default function PeriodCompare({
  indicator,
  series,
  defaultKind,
}: {
  indicator: Indicator;
  series: { kind: PeriodKind; periods: ComparablePeriod[] }[];
  defaultKind?: PeriodKind;
}) {
  const initialKind = series.find((s) => s.kind === defaultKind)?.kind ?? series[0].kind;
  const defaults = (kind: PeriodKind) => {
    const periods = series.find((s) => s.kind === kind)!.periods;
    const b = periods[periods.length - 1].period;
    const sameLastYear = periods.find((p) => p.period === yearsBefore(b, 1));
    const a = kind !== "anual" && sameLastYear ? sameLastYear.period : periods[periods.length - 2].period;
    return { a, b };
  };
  const [kind, setKind] = useState<PeriodKind>(initialKind);
  const [{ a, b }, setPicks] = useState(() => defaults(initialKind));

  const periods = series.find((s) => s.kind === kind)!.periods;
  const byPeriod = new Map(periods.map((p) => [p.period, p]));
  const chooseKind = (k: PeriodKind) => {
    setKind(k);
    setPicks(defaults(k));
  };

  const pa = byPeriod.get(a);
  const pb = byPeriod.get(b);
  // Siempre se describe en orden cronológico, elija como elija el lector.
  const [lo, hi] = pa && pb && pa.period > pb.period ? [pb, pa] : [pa, pb];
  const sameOne = a === b;
  const brokenBy =
    lo && hi ? periods.find((p) => p.period > lo.period && p.period <= hi.period && p.breakBefore) : undefined;
  const delta = lo && hi && !sameOne && !brokenBy ? hi.value - lo.value : undefined;

  const fmt = (v: number) => formatValue(v, indicator.unit, indicator.decimals);
  // En la frase, "$" no se separa del número al cortar la línea.
  const fmtFrase = (v: number) => fmt(v).replace("$ ", "$\u00a0");
  let sentence = "";
  if (lo && hi && delta !== undefined) {
    const verb = delta === 0 ? "se mantuvo igual" : delta > 0 ? "subió" : "bajó";
    sentence =
      delta === 0
        ? `Entre ${enFrase(lo.label)} y ${enFrase(hi.label)} ${verb}: ${fmtFrase(hi.value)}.`
        : `Entre ${enFrase(lo.label)} y ${enFrase(hi.label)} ${verb} ${magnitude(delta, indicator.unit, indicator.decimals, lo.value)}: pasó de ${fmtFrase(lo.value)} a ${fmtFrase(hi.value)}.`;
  }
  const sources = [...new Set([lo?.source, hi?.source].filter(Boolean))].join(" y ");
  const notes = [...new Set([lo?.notes, hi?.notes].filter(Boolean))];

  const chip = (n: number) => {
    const target = yearsBefore(b, n);
    const available = byPeriod.has(target);
    return (
      <button
        key={n}
        type="button"
        disabled={!available}
        onClick={() => setPicks({ a: target, b })}
        className="pressable rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft transition-colors enabled:hover:border-celeste enabled:hover:text-primary disabled:opacity-40"
      >
        {n === 1 ? "un año antes" : "dos años antes"}
      </button>
    );
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card md:p-5">
      {series.length > 1 ? (
        <div role="group" aria-label="Tipo de período" className="mb-4 inline-flex flex-wrap rounded-xl border border-line p-1">
          {series.map((s) => (
            <button
              key={s.kind}
              type="button"
              aria-pressed={kind === s.kind}
              onClick={() => chooseKind(s.kind)}
              className={`pressable rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                kind === s.kind ? "bg-primary text-white" : "text-ink-soft hover:text-primary"
              }`}
            >
              {KIND_LABEL[s.kind]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(["a", "b"] as const).map((which, i) => (
          <label key={which} className="block min-w-0 text-sm">
            <span className="font-semibold text-ink-soft">Período {i + 1}</span>
            <select
              value={which === "a" ? a : b}
              onChange={(e) => setPicks(which === "a" ? { a: e.target.value, b } : { a, b: e.target.value })}
              className="mt-1 w-full min-w-0 rounded-lg border border-control-line bg-surface px-3 py-2.5 text-base"
            >
              {periods.map((p) => (
                <option key={p.period} value={p.period}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
        <span>Comparar el período 2 con el mismo de:</span>
        {chip(1)}
        {chip(2)}
      </div>

      {lo && hi ? (
        <div className="mt-5 border-t border-line pt-4">
          {/* En el celular, flex-wrap: si no entran (pantalla angosta o más
              espaciado de texto), el segundo valor baja de línea en vez de
              desbordar (WCAG 1.4.10 y 1.4.12). */}
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1 sm:grid sm:grid-cols-[1fr_auto_1fr]">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{lo.label}</p>
              <p className="tnum font-display text-2xl font-bold md:text-3xl">{fmt(lo.value)}</p>
            </div>
            <span aria-hidden className="pb-1.5 text-xl text-ink-faint">
              →
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{hi.label}</p>
              <p className="tnum font-display text-2xl font-bold md:text-3xl">{fmt(hi.value)}</p>
            </div>
          </div>
          <div aria-live="polite" className="mt-3">
            {sameOne ? (
              <p className="text-sm text-ink-soft">Elegí dos períodos distintos.</p>
            ) : brokenBy ? (
              <p className="text-sm text-ink-soft">
                No se pueden restar: en {enFrase(brokenBy.label)} cambió la metodología y los dos datos miden
                cosas distintas.
              </p>
            ) : delta !== undefined ? (
              <>
                <Delta delta={delta} indicator={indicator} prevLabel={lo.label} />
                <p className="mt-1 text-sm text-ink">{sentence}</p>
              </>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-ink-faint">Fuente: {sources}</p>
          {notes.map((n) => (
            <p key={n} className="mt-1 text-xs text-ink-faint">
              {n}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
