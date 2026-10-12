import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EmbedFrame from "@/components/embed/EmbedFrame";
import RankingList from "@/components/charts/RankingList";
import { activeIndicators, getIndicator } from "@/data/dictionary";
import { getObservationSource } from "@/data/sources";
import { getDepartmentRanking } from "@/lib/data";
import { formatValue } from "@/lib/format";

export function generateStaticParams() {
  return activeIndicators
    .filter((i) => getDepartmentRanking(i.id).length >= 2)
    .map((i) => ({ slug: i.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Ranking para insertar — ${slug}` };
}

export default async function EmbedRankingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const indicator = getIndicator(slug);
  if (!indicator || indicator.status !== "active") notFound();

  const ranking = getDepartmentRanking(indicator.id);
  if (ranking.length < 2) notFound();

  const source = getObservationSource(indicator.sourceId, ranking[0].obs);
  const period = ranking[0].obs.periodLabel;

  return (
    <EmbedFrame
      title={indicator.name}
      subtitle={`Ranking por departamento · ${period}`}
      sourceLine={`Fuente: ${source?.shortName ?? indicator.sourceId} · ${period}`}
      href={`/indicadores/${indicator.slug}`}
    >
      {/* Sin enlaces: dentro de un iframe, navegar sacaría al lector de la nota. */}
      <RankingList
        entries={ranking.map((r) => ({
          label: r.territory.name,
          value: r.obs.value!,
          display: formatValue(r.obs.value!, indicator.unit, indicator.decimals),
        }))}
      />
    </EmbedFrame>
  );
}
