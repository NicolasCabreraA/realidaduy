import { activeIndicators, getIndicator } from "@/data/dictionary";
import { getObservationSource, getSource } from "@/data/sources";
import { getDepartmentRanking, getLatest } from "@/lib/data";
import { formatValue } from "@/lib/format";
import { renderOgImage } from "@/lib/og";

// Imágenes de vista previa por indicador, en una URL propia y estable
// (/og/indicador/<slug>.png) en vez de la convención opengraph-image de Next:
// esa emite og:image:alt y og:image:type ANTES de og:image, fuera del orden que
// manda el spec, y LinkedIn descarta la imagen. Con ruta propia, la página
// declara la imagen en su metadata y el orden queda bien.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return activeIndicators.map((i) => ({ archivo: `${i.slug}.png` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await params;
  const indicator = getIndicator(archivo.replace(/\.png$/, ""));
  if (!indicator) return new Response("No encontrado", { status: 404 });

  const latest = getLatest(indicator.id, "UY");
  const hasValue = Boolean(latest && latest.obs.value !== null);
  const ranking = hasValue ? [] : getDepartmentRanking(indicator.id);
  const deptCount = ranking.length;
  // La fuente del dato que muestra la imagen: el nacional o, si no hay, el del ranking.
  const shown = hasValue ? latest?.obs : ranking[0]?.obs;
  const source = shown ? getObservationSource(indicator.sourceId, shown) : getSource(indicator.sourceId);

  return renderOgImage({
    eyebrow: "Indicador",
    title: indicator.question,
    value:
      hasValue && latest
        ? formatValue(latest.obs.value!, indicator.unit, indicator.decimals)
        : undefined,
    valueLabel:
      hasValue && latest ? `${indicator.unitLabel} · ${latest.obs.periodLabel}` : undefined,
    meta: hasValue
      ? `${indicator.name} · Fuente: ${source?.shortName ?? "oficial"}`
      : deptCount > 0
        ? `${indicator.name} · ${deptCount} departamentos · Fuente: ${source?.shortName ?? "oficial"}`
        : indicator.name,
  });
}
