// API de acceso a datos. Toda la UI consume estas funciones; cuando la capa de
// datos migre de archivos estáticos a una base real (V2+), solo cambia este módulo.

import type { Indicator, Observation, Territory } from "@/lib/types";
import { dictionary, getIndicator } from "@/data/dictionary";
import { nationalObservations } from "@/data/observations/nacional";
import { departmentObservations } from "@/data/observations/departamentos";
import { municipioObservations } from "@/data/observations/municipios";
import { departmentEchObservations } from "@/data/observations/departamentos-ech";
import { otuObservations } from "@/data/observations/otu";
import { otuMunicipioObservations } from "@/data/observations/otu-municipios";
import { otuCensalObservations } from "@/data/observations/otu-censal";
import { ineMensualObservations } from "@/data/observations/ine-mensual";
import { seguridadObservations } from "@/data/observations/seguridad";
import { worldBankSeries } from "@/data/observations/series-banco-mundial";
import { prismaObservations } from "@/data/observations/prisma";
import { bcuPibObservations } from "@/data/observations/bcu-pib";
import { bcuCotizacionesObservations } from "@/data/observations/bcu-cotizaciones";
import { ineAnualesObservations } from "@/data/observations/ine-anuales";
import { departments, getTerritoryById } from "@/data/territories";

export { dictionary, getIndicator };
export * from "@/data/territories";
export * from "@/data/elections";
export { getSource, sources } from "@/data/sources";

const allObservations: Observation[] = [
  ...nationalObservations,
  ...departmentObservations,
  ...departmentEchObservations,
  ...otuObservations,
  ...otuMunicipioObservations,
  ...otuCensalObservations,
  ...ineMensualObservations,
  ...seguridadObservations,
  ...municipioObservations,
  ...worldBankSeries,
  ...prismaObservations,
  ...bcuPibObservations,
  ...bcuCotizacionesObservations,
  ...ineAnualesObservations,
];

/** Todas las observaciones de la plataforma (usado por las descargas CSV). */
export function getAllObservations(): Observation[] {
  return allObservations;
}

/** Todas las observaciones de un indicador, en todos los territorios. */
export function getIndicatorObservations(indicatorId: string): Observation[] {
  return allObservations.filter((o) => o.indicatorId === indicatorId);
}

/** Observaciones de un indicador en un territorio, ordenadas por período. */
export function getObservations(indicatorId: string, territoryId: string): Observation[] {
  return allObservations
    .filter((o) => o.indicatorId === indicatorId && o.territoryId === territoryId)
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Serie homogénea para gráficos: mismo indicador, territorio y granularidad de
 * período, filtrable por estado (p. ej. solo la serie anual SECONDARY del Banco
 * Mundial). Nunca mezcla granularidades en una misma serie.
 */
export function getSeries(
  indicatorId: string,
  territoryId: string,
  opts?: { status?: Observation["status"]; periodLength?: number }
): Observation[] {
  let obs = getObservations(indicatorId, territoryId).filter((o) => o.value !== null);
  if (opts?.status) obs = obs.filter((o) => o.status === opts.status);
  const len = opts?.periodLength ?? obs[obs.length - 1]?.period.length;
  return obs.filter((o) => o.period.length === len);
}

/**
 * Serie anual del gráfico de evolución y del sparkline. Si hay una serie
 * oficial de al menos 4 años consecutivos, se usa esa; si no, la del Banco
 * Mundial (secundaria). Nunca mezcla oficial con secundaria: miden lo mismo con
 * bases distintas. La oficial puede venir de dos archivos cuando es la misma
 * serie empalmada: hoy, el PIB del BCU (PRISMA hasta 2016, BCU desde 2017).
 */
export function getHistorySeries(indicatorId: string, territoryId: string): Observation[] {
  const annual = getSeries(indicatorId, territoryId, { periodLength: 4 });
  const official = annual.filter((o) => o.status !== "SECONDARY");
  const consecutive = official.every(
    (o, i) => i === 0 || Number(o.period) === Number(official[i - 1].period) + 1
  );
  if (official.length >= 4 && consecutive) return official;
  return annual.filter((o) => o.status === "SECONDARY");
}

export interface LatestResult {
  obs: Observation;
  /** Observación inmediatamente anterior de la misma granularidad, si existe. */
  prev?: Observation;
  delta?: number;
}

/**
 * Último dato disponible + variación respecto al período anterior comparable.
 * Si existen datos de mejor jerarquía que SECONDARY (p. ej. el Censo frente a la
 * estimación del Banco Mundial), los titulares nunca usan la fuente secundaria.
 */
export function getLatest(indicatorId: string, territoryId: string): LatestResult | undefined {
  let obs = getObservations(indicatorId, territoryId).filter((o) => o.value !== null);
  if (obs.some((o) => o.status !== "SECONDARY")) {
    obs = obs.filter((o) => o.status !== "SECONDARY");
  }
  if (obs.length === 0) return undefined;
  const latest = obs[obs.length - 1];
  // Quiebre metodológico: jamás se compara contra el período anterior.
  if (latest.breakBefore) return { obs: latest };
  const comparable = obs.filter(
    (o) => o.period.length === latest.period.length && o.period < latest.period
  );
  const prev = comparable[comparable.length - 1];
  const delta =
    prev && latest.value !== null && prev.value !== null ? latest.value - prev.value : undefined;
  return { obs: latest, prev, delta };
}

export interface RankingEntry {
  territory: Territory;
  obs: Observation;
}

/** Último valor por departamento, ordenado descendente. */
export function getDepartmentRanking(indicatorId: string): RankingEntry[] {
  const entries: RankingEntry[] = [];
  for (const d of departments) {
    const latest = getLatest(indicatorId, d.id);
    if (latest && latest.obs.value !== null) entries.push({ territory: d, obs: latest.obs });
  }
  return entries.sort((a, b) => (b.obs.value ?? 0) - (a.obs.value ?? 0));
}

/** Indicadores activos que declaran datos para un nivel territorial. */
export function indicatorsForLevel(level: Territory["level"]): Indicator[] {
  return dictionary.filter((i) => i.status === "active" && i.geographicLevel.includes(level));
}

export type PeriodKind = "mensual" | "trimestral" | "semestral" | "anual";

const PERIOD_KIND: [PeriodKind, RegExp][] = [
  ["mensual", /^\d{4}-(0[1-9]|1[0-2])$/],
  ["trimestral", /^\d{4}-Q[1-4]$/],
  ["semestral", /^\d{4}-S[12]$/],
  ["anual", /^\d{4}$/],
];

/** Granularidad de un período ("2026-S1" → semestral); undefined si es diario. */
export function periodKind(period: string): PeriodKind | undefined {
  return PERIOD_KIND.find(([, re]) => re.test(period))?.[0];
}

export interface ComparablePeriod {
  period: string;
  label: string;
  value: number;
  /** Nombre corto del organismo de este dato. */
  source: string;
  breakBefore: boolean;
  notes?: string;
}

/**
 * Series para comparar dos períodos de la misma granularidad (mes contra mes,
 * semestre contra semestre…). Cada granularidad usa una sola jerarquía de
 * fuente: la oficial si tiene al menos dos períodos y, solo en la anual, la
 * secundaria (Banco Mundial) si no hay oficial. Nunca mezcla las dos. Solo
 * devuelve las granularidades con dos períodos o más.
 */
export function getComparableSeries(
  indicatorId: string,
  territoryId: string,
  sourceName: (o: Observation) => string
): { kind: PeriodKind; periods: ComparablePeriod[] }[] {
  const obs = getObservations(indicatorId, territoryId).filter((o) => o.value !== null);
  const out: { kind: PeriodKind; periods: ComparablePeriod[] }[] = [];
  for (const [kind] of PERIOD_KIND) {
    const ofKind = obs.filter((o) => periodKind(o.period) === kind);
    const official = ofKind.filter((o) => o.status !== "SECONDARY");
    const chosen =
      official.length >= 2
        ? official
        : kind === "anual"
          ? ofKind.filter((o) => o.status === "SECONDARY")
          : [];
    if (chosen.length < 2) continue;
    out.push({
      kind,
      periods: chosen.map((o) => ({
        period: o.period,
        label: o.periodLabel,
        value: o.value!,
        source: sourceName(o),
        breakBefore: Boolean(o.breakBefore),
        notes: o.notes,
      })),
    });
  }
  return out;
}

/** ¿Tiene el indicador al menos una observación en este territorio? */
export function hasData(indicatorId: string, territoryId: string): boolean {
  return getObservations(indicatorId, territoryId).some((o) => o.value !== null);
}

export { getTerritoryById };
