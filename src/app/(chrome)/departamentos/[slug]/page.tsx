import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { departments, getDepartmentBySlug, municipalitiesOf } from "@/data/territories";
import { getElectionResults, getGovernment, getParty, turnout } from "@/data/elections";
import PartyBars from "@/components/charts/PartyBars";
import { getIndicator } from "@/data/dictionary";
import { getLatest, hasData, indicatorsForLevel } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { PartyBadge } from "@/components/ui/Badge";
import MetricCard from "@/components/charts/MetricCard";
import ShareButton from "@/components/share/ShareButton";
import SourceNote from "@/components/ui/SourceNote";
import CatalogCredit from "@/components/ui/CatalogCredit";
import { CONJUNTO_ELECCIONES_2024, CONJUNTO_ELECCIONES_2025 } from "@/data/catalogo";
import StateView from "@/components/ui/StateView";
import { SITE_NAME } from "@/lib/site";
import TableWrap from "@/components/ui/TableWrap";

export function generateStaticParams() {
  return departments.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dept = getDepartmentBySlug(slug);
  if (!dept) return {};
  const description = `Datos públicos de ${dept.name}: población del Censo 2023, gobierno departamental 2025 y más, con fuentes verificables.`;
  return {
    title: `${dept.name} — Perfil territorial`,
    description,
    alternates: { canonical: `/departamentos/${dept.slug}` },
    openGraph: {
      title: `${dept.name} · ${SITE_NAME}`,
      description,
      url: `/departamentos/${dept.slug}`,
      images: [
        {
          url: `/og/departamento/${dept.slug}.png`,
          width: 1200,
          height: 630,
          alt: `Perfil de ${dept.name} en ${SITE_NAME}`,
          type: "image/png",
        },
      ],
    },
  };
}

export default async function DepartmentProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dept = getDepartmentBySlug(slug);
  if (!dept) notFound();

  const poblacion = getLatest("poblacion", dept.id);
  const poblacionUY = getLatest("poblacion", "UY");
  const indicadorPoblacion = getIndicator("poblacion")!;
  const gov = getGovernment(dept.id);
  const party = gov ? getParty(gov.partyId) : undefined;
  const turnout2025 = turnout.find((t) => t.electionId === "departamental-2025");
  const share =
    poblacion?.obs.value && poblacionUY?.obs.value
      ? (poblacion.obs.value / poblacionUY.obs.value) * 100
      : null;
  // Los indicadores de educación van en su propio panel (/departamentos/[slug]/educacion).
  const deptMetricIds = indicatorsForLevel("departamento")
    .filter((i) => i.subCategory !== "educacion")
    .map((i) => i.id)
    .filter((id) => id !== "poblacion" && hasData(id, dept.id));
  const toBars = (electionId: string) =>
    getElectionResults(electionId, dept.id)
      .filter((r) => r.pct !== null)
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
      .map((r) => {
        const p = getParty(r.partyId)!;
        return { name: p.name, color: p.color, pct: r.pct ?? 0 };
      });
  const bars2025 = toBars("departamental-2025");
  const bars2024 = toBars("nacional-2024");
  const munis = municipalitiesOf(dept.id).map((m) => ({
    territory: m,
    winner: getElectionResults("municipal-2025", m.id).find((r) => r.winner),
  }));
  const munisConNombre = munis.some((m) => m.winner?.electedName);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <nav aria-label="Miga de pan" className="text-sm text-ink-faint">
        <Link className="hover:text-primary" href="/departamentos">
          Departamentos
        </Link>{" "}
        / <span className="text-ink-soft">{dept.name}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold md:text-5xl">{dept.name}</h1>
          <p className="mt-1 text-ink-faint">Capital: {dept.capital}</p>
        </div>
        <Link
          href={`/comparar?a=${dept.slug}`}
          className="pressable rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-primary transition-colors hover:border-celeste"
        >
          Comparar con otro territorio
        </Link>
      </div>

      {/* Panorama */}
      <section aria-labelledby="panorama" className="mt-8">
        <h2 id="panorama" className="font-display text-2xl font-bold">
          Panorama
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="text-sm font-bold text-ink-soft">Población</p>
            {poblacion?.obs.value ? (
              <>
                <p className="tnum mt-1 font-display text-3xl font-bold">
                  {formatNumber(poblacion.obs.value)}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  {poblacion.obs.periodLabel} · INE
                  {share !== null ? ` · ${formatNumber(share, 1)}% del país` : ""}
                </p>
              </>
            ) : (
              <StateView kind="nodata" compact />
            )}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:col-span-2">
            <p className="text-sm font-bold text-ink-soft">Gobierno departamental</p>
            {gov && party ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <PartyBadge color={party.color} name={party.name} />
                </div>
                <p className="text-lg">
                  Intendente: <span className="font-bold">{gov.electedName}</span>
                </p>
                <p className="text-xs text-ink-faint">
                  Elecciones departamentales del 11 de mayo de 2025 · Corte Electoral
                </p>
              </div>
            ) : (
              <StateView kind="nodata" compact />
            )}
          </div>
        </div>
      </section>

      {/* Política */}
      <section aria-labelledby="politica" className="mt-10">
        <h2 id="politica" className="font-display text-2xl font-bold">
          Política
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div data-share-card className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold">Elección departamental 2025</h3>
              <ShareButton
                filename={`departamental-2025-${dept.slug}`}
                title={`Elección departamental 2025 en ${dept.name}`}
              />
            </div>
            {gov && party ? (
              <p className="mt-2 text-sm text-ink-soft">
                Intendente electo: <strong className="text-ink">{gov.electedName}</strong> (
                {party.name}) · Participación nacional:{" "}
                <span className="tnum">
                  {turnout2025 ? `${formatNumber(turnout2025.pct, 2)}%` : "—"}
                </span>
              </p>
            ) : (
              <StateView kind="nodata" compact />
            )}
            {bars2025.length > 0 ? (
              <div className="mt-3">
                <PartyBars compact rows={bars2025} />
              </div>
            ) : null}
            <p className="mt-3 text-xs text-ink-faint">
              % sobre votos válidos al lema en {dept.name}. Fuente: Corte Electoral,
              desglose oficial por circuito (11 de mayo de 2025),{" "}
              <CatalogCredit sourceUrl={CONJUNTO_ELECCIONES_2025} />.
            </p>
          </div>
          <div data-share-card className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold">
                Primera vuelta 2024 en {dept.name}
              </h3>
              <ShareButton
                filename={`primera-vuelta-2024-${dept.slug}`}
                title={`Primera vuelta 2024 en ${dept.name}`}
              />
            </div>
            {bars2024.length > 0 ? (
              <div className="mt-3">
                <PartyBars compact rows={bars2024} />
              </div>
            ) : (
              <div className="mt-3">
                <StateView kind="nodata" compact />
              </div>
            )}
            <p className="mt-3 text-xs text-ink-faint">
              % sobre el total de votos emitidos en {dept.name} (27 de octubre de 2024).
              Fuente: Corte Electoral, desglose oficial por circuito,{" "}
              <CatalogCredit sourceUrl={CONJUNTO_ELECCIONES_2024} />.
            </p>
            <Link
              href="/elecciones"
              data-no-export
              className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
            >
              Ver resultados nacionales →
            </Link>
          </div>
        </div>
      </section>

      {/* Municipios del departamento */}
      {munis.length > 0 ? (
        <section aria-labelledby="municipios-dept" className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="municipios-dept" className="font-display text-2xl font-bold">
              Municipios de {dept.name}
              <span className="ml-2 text-base font-semibold text-ink-faint">
                {munis.length}
              </span>
            </h2>
            <Link
              className="text-sm font-semibold text-primary hover:underline"
              href="/municipios"
            >
              Ver los 136 del país →
            </Link>
          </div>
          <TableWrap label={`Municipios de ${dept.name}`} className="mt-4">
            <table className="tabla min-w-[420px]">
              <caption className="sr-only">
                Municipios de {dept.name} y lema ganador de la alcaldía en 2025
              </caption>
              <thead>
                <tr>
                  <th scope="col">Municipio</th>
                  <th scope="col" className="num">Población (2023)</th>
                  {munisConNombre ? <th scope="col">Alcalde/sa</th> : null}
                  <th scope="col">Lema ganador (2025)</th>
                  <th scope="col" className="num">% válidos</th>
                </tr>
              </thead>
              <tbody>
                {munis.map(({ territory, winner }) => {
                  const wParty = winner ? getParty(winner.partyId) : undefined;
                  const pop = getLatest("poblacion", territory.id);
                  return (
                    <tr key={territory.id}>
                      <td>{territory.name}</td>
                      <td className="num">
                        {pop?.obs.value ? formatNumber(pop.obs.value) : "—"}
                      </td>
                      {munisConNombre ? <td>{winner?.electedName ?? "—"}</td> : null}
                      <td>
                        {wParty ? (
                          <PartyBadge color={wParty.color} name={wParty.shortName} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num">
                        {winner?.pct !== null && winner?.pct !== undefined
                          ? `${formatNumber(winner.pct, 1)}%`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          <p className="mt-2 text-xs text-ink-faint">
            Resultados: Corte Electoral, desglose oficial por circuito,{" "}
            <CatalogCredit sourceUrl={CONJUNTO_ELECCIONES_2025} />. Población: Censo 2023
            del INE,{" "}
            {dept.id === "UY-MO"
              ? "agregada por municipio desde la cartografía censal."
              : "por municipio según el Observatorio Territorio Uruguay (OPP)."}{" "}
            No todo el territorio departamental está municipalizado.
          </p>
        </section>
      ) : null}

      {/* Economía y sociedad — datos departamentales */}
      <section aria-labelledby="datos-dept" className="mt-10">
        <h2 id="datos-dept" className="font-display text-2xl font-bold">
          Economía y sociedad
        </h2>
        {deptMetricIds.length > 0 ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deptMetricIds.map((id) => (
                <MetricCard key={id} indicatorId={id} territoryId={dept.id} />
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              Tocá una tarjeta para ver qué significa el indicador, su evolución y el ranking
              de los 19 departamentos.
            </p>
          </>
        ) : (
          <div className="mt-4">
            <StateView kind="nodata-departamental" />
          </div>
        )}
      </section>

      {/* Educación: panel aparte */}
      <section aria-labelledby="educacion" className="mt-10">
        <h2 id="educacion" className="sr-only">
          Educación
        </h2>
        <Link
          href={`/departamentos/${dept.slug}/educacion`}
          className="pressable block rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-celeste"
        >
          <p className="font-display text-lg font-bold text-primary">Educación en {dept.name} →</p>
          <p className="mt-1 text-sm text-ink-soft">
            Carreras, de dónde vienen los estudiantes, qué estudian afuera los de {dept.name}, 6º de
            liceo y UTU.
          </p>
        </Link>
      </section>

      {/* Fuente */}
      <section aria-labelledby="fuente" className="mt-10">
        <h2 id="fuente" className="sr-only">
          Fuente de los datos
        </h2>
        <SourceNote indicator={indicadorPoblacion} obs={poblacion?.obs} />
      </section>
    </div>
  );
}
