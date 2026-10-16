import Link from "next/link";
import { getIndicator } from "@/data/dictionary";
import { getHistorySeries, getLatest } from "@/lib/data";
import { getObservationSource } from "@/data/sources";
import Delta from "@/components/charts/Delta";
import StateView from "@/components/ui/StateView";
import MetricValue from "@/components/charts/MetricValue";
import Sparkline from "@/components/charts/Sparkline";
import { TextureCard, TextureCardContent } from "@/components/cult/TextureCard";
import { cn } from "@/lib/utils";

export default function MetricCard({
  indicatorId,
  territoryId = "UY",
  href,
  featured = false,
}: {
  indicatorId: string;
  territoryId?: string;
  href?: string;
  /** Tarjeta destacada del bento: cifra más grande y sparkline amplio. */
  featured?: boolean;
}) {
  const indicator = getIndicator(indicatorId);
  if (!indicator) return null;
  const latest = getLatest(indicatorId, territoryId);
  const target = href ?? `/indicadores/${indicator.slug}`;
  // Serie anual para el mini-gráfico decorativo: la misma del gráfico de
  // evolución (oficial si la hay, si no Banco Mundial).
  const history = getHistorySeries(indicatorId, territoryId);
  const series = history.map((o) => o.value).filter((v): v is number => v !== null);

  const latestValue = latest?.obs.value;
  if (!latest || latestValue === null || latestValue === undefined) {
    return (
      <TextureCard>
        <TextureCardContent className="p-4">
          <p className="text-sm font-bold text-ink-soft">{indicator.name}</p>
          <div className="mt-2">
            <StateView kind="pending" compact />
          </div>
        </TextureCardContent>
      </TextureCard>
    );
  }

  const { obs, delta, prev } = latest;
  const source = getObservationSource(indicator.sourceId, obs);
  return (
    <Link
      href={target}
      className="group block h-full rounded-2xl transition-transform duration-150 active:scale-[0.99] focus-visible:outline-focus"
    >
      <TextureCard className="h-full transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:border-celeste group-active:translate-y-0">
        <TextureCardContent className="flex h-full flex-col p-4">
          <p className="text-sm font-bold text-ink-soft">{indicator.name}</p>
          <p
            className={cn(
              "tnum mt-1 font-display font-bold text-ink",
              featured ? "text-4xl md:text-6xl" : "text-3xl md:text-4xl"
            )}
          >
            <MetricValue value={latestValue} unit={indicator.unit} decimals={indicator.decimals} />
          </p>
          <div className="mt-1 min-h-5">
            {delta !== undefined ? (
              <Delta delta={delta} indicator={indicator} prevLabel={prev?.periodLabel} />
            ) : null}
          </div>
          {series.length >= 4 ? (
            <div className={cn("mt-2", featured ? "" : "max-w-[140px]")}>
              <Sparkline
                values={series}
                width={featured ? 320 : 120}
                height={featured ? 56 : 34}
              />
            </div>
          ) : null}
          <p className="mt-auto pt-2 text-xs text-ink-faint">
            {obs.periodLabel} · {source?.shortName ?? indicator.sourceId}
            {series.length >= 4 ? (
              <span> · serie desde {history[0].period}</span>
            ) : null}
          </p>
        </TextureCardContent>
      </TextureCard>
    </Link>
  );
}
