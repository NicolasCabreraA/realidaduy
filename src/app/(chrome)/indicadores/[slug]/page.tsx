import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { activeIndicators, getIndicator } from "@/data/dictionary";
import {
  getComparableSeries,
  getDepartmentRanking,
  getHistorySeries,
  getLatest,
  periodKind,
} from "@/lib/data";
import { getObservationSource, getSource } from "@/data/sources";
import { formatNumber, formatValue } from "@/lib/format";
import { downloadForIndicator } from "@/lib/downloads";
import { SITE_NAME } from "@/lib/site";
import EmbedButton from "@/components/embed/EmbedButton";
import { StatusBadge } from "@/components/ui/Badge";
import Delta from "@/components/charts/Delta";
import ChartCard from "@/components/charts/ChartCard";
import LineChart from "@/components/charts/LineChart";
import RankingList from "@/components/charts/RankingList";
import PeriodCompare from "@/components/charts/PeriodCompare";
import SourceNote from "@/components/ui/SourceNote";
import StateView from "@/components/ui/StateView";

export function generateStaticParams() {
  return activeIndicators.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const indicator = getIndicator(slug);
  if (!indicator) return {};
  return {
    title: indicator.name,
    description: `${indicator.question} ${indicator.plainDefinition}`,
    // getIndicator también acepta el id (/indicadores/inflacion-interanual):
    // la canónica es siempre la del slug, para que no cuente como duplicada.
    alternates: { canonical: `/indicadores/${indicator.slug}` },
    openGraph: {
      title: `${indicator.question} · ${SITE_NAME}`,
      description: `${indicator.question} ${indicator.plainDefinition}`,
      url: `/indicadores/${indicator.slug}`,
      images: [
        {
          url: `/og/indicador/${indicator.slug}.png`,
          width: 1200,
          height: 630,
          alt: `${indicator.name} en ${SITE_NAME}, con su último dato, período y fuente`,
          type: "image/png",
        },
      ],
    },
  };
}

export default async function IndicadorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const indicator = getIndicator(slug);
  if (!indicator || indicator.status !== "active") notFound();

  const latest = getLatest(indicator.id, "UY");
  const source = getSource(indicator.sourceId);
  const history = getHistorySeries(indicator.id, "UY");
  const historyOfficial = history[0]?.status !== "SECONDARY";
  // Tramos por fuente, para citar cada una con sus años (el PIB empalma PRISMA
  // hasta 2016 y BCU desde 2017).
  const historySegments: { name: string; from: string; to: string }[] = [];
  for (const o of history) {
    const name = getObservationSource(indicator.sourceId, o)?.shortName ?? "";
    const last = historySegments[historySegments.length - 1];
    if (last?.name === name) last.to = o.period;
    else historySegments.push({ name, from: o.period, to: o.period });
  }
  const historySourceLine =
    historySegments.length === 1
      ? `${historySegments[0].name} · ${historySegments[0].from}–${historySegments[0].to}`
      : historySegments.map((s) => `${s.name} ${s.from}–${s.to}`).join(" y ");
  const ranking = indicator.geographicLevel.includes("departamento")
    ? getDepartmentRanking(indicator.id)
    : [];
  const csv = downloadForIndicator(indicator.slug);
  // Dos períodos de la misma granularidad, elegidos por el lector (país).
  const comparable = getComparableSeries(
    indicator.id,
    "UY",
    (o) => getObservationSource(indicator.sourceId, o)?.shortName ?? ""
  );
  const PLURAL = { mensual: "meses", trimestral: "trimestres", semestral: "semestres", anual: "años" };
  const kinds = comparable.map((c) => PLURAL[c.kind]);
  const kindsText = kinds.length > 1 ? `${kinds.slice(0, -1).join(", ")} o ${kinds[kinds.length - 1]}` : kinds[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <nav aria-label="Miga de pan" className="text-sm text-ink-faint">
        <Link className="hover:text-primary" href="/indicadores">
          Indicadores
        </Link>{" "}
        / <span className="text-ink-soft">{indicator.name}</span>
      </nav>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">{indicator.question}</h1>
      <p className="mt-1 text-ink-faint">{indicator.name}</p>

      {/* Lo que un medio necesita: el dato crudo y el gráfico embebible. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {csv && csv.rows > 0 ? (
          <a
            href={`/datos/${csv.file}`}
            download
            className="pressable inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-celeste hover:text-primary"
          >
            <svg
              aria-hidden
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 1.8v8.4" />
              <path d="M4.6 7.2 8 10.6l3.4-3.4" />
              <path d="M2.2 13.2h11.6" />
            </svg>
            Descargar CSV · {formatNumber(csv.rows)} filas
          </a>
        ) : null}
        {ranking.length >= 2 ? (
          <EmbedButton
            title={indicator.name}
            options={[
              { label: "Mapa", path: `/embed/mapa/${indicator.slug}`, height: 660 },
              { label: "Ranking", path: `/embed/ranking/${indicator.slug}`, height: 860 },
            ]}
          />
        ) : null}
      </div>

      {/* Último dato */}
      <section aria-labelledby="ultimo-dato" className="mt-6">
        <h2 id="ultimo-dato" className="sr-only">
          Último dato disponible
        </h2>
        {latest && latest.obs.value !== null ? (
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="tnum font-display text-5xl font-bold">
                {formatValue(latest.obs.value, indicator.unit, indicator.decimals)}
              </p>
              {latest.delta !== undefined ? (
                <Delta
                  delta={latest.delta}
                  indicator={indicator}
                  prevLabel={latest.prev?.periodLabel}
                />
              ) : null}
            </div>
            <p className="mt-1 text-sm text-ink-soft">{indicator.unitLabel}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
              <span>
                {latest.obs.periodLabel} · {getObservationSource(indicator.sourceId, latest.obs)?.shortName}
              </span>
              <StatusBadge status={latest.obs.status} />
            </div>
            {latest.obs.notes ? (
              <p className="mt-2 text-sm text-ink-soft">{latest.obs.notes}</p>
            ) : null}
          </div>
        ) : indicator.geographicLevel.includes("pais") ? (
          <StateView kind="pending" />
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft shadow-card">
            Este indicador se publica por departamento: el detalle está en el ranking de más
            abajo.
          </div>
        )}
      </section>

      {/* ¿Qué significa? */}
      <section aria-labelledby="que-significa" className="mt-6">
        <div className="rounded-2xl border-l-4 border-primary bg-primary-soft/60 px-4 py-3">
          <h2 id="que-significa" className="text-sm font-bold uppercase tracking-wide text-primary">
            ¿Qué significa?
          </h2>
          <p className="mt-1 text-ink">{indicator.plainDefinition}</p>
        </div>
      </section>

      {/* Evolución */}
      <section aria-labelledby="evolucion" className="mt-8">
        <h2 id="evolucion" className="sr-only">
          Evolución histórica
        </h2>
        {history.length >= 4 ? (
          <ChartCard
            question={`${indicator.question} — evolución`}
            subtitle={
              historyOfficial
                ? "Serie anual oficial"
                : "Serie anual comparable (fuente secundaria internacional)"
            }
            sourceLine={`Fuente: ${historySourceLine} · Serie anual`}
            note={[...new Set(history.map((o) => o.notes).filter(Boolean))].join(" ")}
            table={{
              caption: `Evolución anual de ${indicator.name}`,
              head: ["Año", indicator.name],
              rows: history.map((o) => [
                o.period,
                formatValue(o.value!, indicator.unit, indicator.decimals),
              ]),
            }}
          >
            <LineChart
              data={history.map((o) => ({ x: o.period, y: o.value! }))}
              unit={indicator.unit}
              decimals={indicator.decimals}
            />
          </ChartCard>
        ) : indicator.geographicLevel.includes("pais") ? (
          <StateView
            kind="pending"
            detail={`La serie histórica oficial (${source?.shortName}) se ingerirá y validará antes de publicarse.`}
          />
        ) : (
          <p className="text-sm text-ink-faint">
            La serie histórica {indicator.availableFrom ? `(${indicator.availableFrom}–hoy) ` : ""}
            está disponible en la fuente; el gráfico de evolución se sumará en una próxima
            versión.
          </p>
        )}
      </section>

      {/* Comparar dos períodos */}
      {comparable.length > 0 ? (
        <section aria-labelledby="comparar-periodos" className="mt-8">
          <h2 id="comparar-periodos" className="font-display text-2xl font-bold">
            Compará dos períodos
          </h2>
          <p className="mt-1 text-sm text-ink-faint">
            Elegí dos {kindsText} del país y mirá cuánto cambió.
          </p>
          <div className="mt-4">
            <PeriodCompare
              indicator={indicator}
              series={comparable}
              defaultKind={latest ? periodKind(latest.obs.period) : undefined}
            />
          </div>
        </section>
      ) : null}

      {/* Por departamento */}
      <section aria-labelledby="por-departamento" className="mt-8">
        <h2 id="por-departamento" className="font-display text-2xl font-bold">
          Por departamento
        </h2>
        <div className="mt-4">
          {ranking.length > 0 ? (
            <ChartCard
              question={`¿Dónde ${indicator.id === "poblacion" ? "vive más gente" : "es mayor"}?`}
              subtitle={`${indicator.name} por departamento`}
              sourceLine={`Fuente: ${getObservationSource(indicator.sourceId, ranking[0].obs)?.name} · ${ranking[0].obs.periodLabel}`}
              table={{
                caption: `${indicator.name} por departamento`,
                head: ["Departamento", indicator.name],
                rows: ranking.map((r) => [
                  r.territory.name,
                  formatValue(r.obs.value!, indicator.unit, indicator.decimals),
                ]),
              }}
            >
              <RankingList
                entries={ranking.map((r) => ({
                  label: r.territory.name,
                  href: `/departamentos/${r.territory.slug}`,
                  value: r.obs.value!,
                  display: formatNumber(r.obs.value!, indicator.decimals),
                }))}
              />
            </ChartCard>
          ) : indicator.geographicLevel.includes("departamento") ? (
            <StateView kind="nodata-departamental" />
          ) : (
            <StateView
              kind="nodata"
              detail="Este indicador se publica únicamente a nivel nacional."
            />
          )}
        </div>
      </section>

      {/* Fuente */}
      <section className="mt-8">
        <SourceNote indicator={indicator} obs={latest?.obs} />
      </section>
    </div>
  );
}
