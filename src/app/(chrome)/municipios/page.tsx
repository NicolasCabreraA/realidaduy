import type { Metadata } from "next";
import Link from "next/link";
import { departments, municipalitiesOf, municipalTerritories } from "@/data/territories";
import { electionResults, getParty } from "@/data/elections";
import { getLatest } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { PartyBadge } from "@/components/ui/Badge";
import CatalogCredit from "@/components/ui/CatalogCredit";
import { CONJUNTO_ELECCIONES_2025 } from "@/data/catalogo";
import TableWrap from "@/components/ui/TableWrap";

export const metadata: Metadata = {
  title: "Municipios de Uruguay",
  description:
    "Los 136 municipios de Uruguay: qué lema ganó la alcaldía en cada uno en las elecciones de mayo de 2025, departamento por departamento, con datos oficiales de la Corte Electoral.",
};

export default function MunicipiosPaisPage() {
  const winnerOf = (territoryId: string) =>
    electionResults.find(
      (r) => r.electionId === "municipal-2025" && r.territoryId === territoryId && r.winner
    );

  // Balance nacional de alcaldías por lema.
  const balance = new Map<string, number>();
  for (const m of municipalTerritories) {
    const w = winnerOf(m.id);
    if (w) balance.set(w.partyId, (balance.get(w.partyId) ?? 0) + 1);
  }
  const balanceRows = [...balance.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([partyId, count]) => ({ party: getParty(partyId)!, count }));
  const total = municipalTerritories.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">Política</p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">
        Los {total} municipios de Uruguay
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        El municipio es el tercer nivel de gobierno, con alcalde/sa y concejo electos cada
        cinco años. Acá está qué lema ganó cada alcaldía el 11 de mayo de 2025, calculado
        desde el desglose oficial por circuito de la Corte Electoral. No todo el territorio
        del país está municipalizado.
      </p>

      {/* Balance nacional */}
      <section aria-labelledby="balance" className="mt-8">
        <h2 id="balance" className="sr-only">
          Balance nacional de alcaldías
        </h2>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm font-bold text-ink-soft">
            ¿Cuántas alcaldías ganó cada lema?
          </p>
          <div
            aria-hidden
            className="mt-3 flex h-6 w-full overflow-hidden rounded-lg border border-ink/10"
          >
            {balanceRows.map(({ party, count }) => (
              <span
                key={party.id}
                style={{ width: `${(count / total) * 100}%`, background: party.color }}
                title={`${party.name}: ${count}`}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {balanceRows.map(({ party, count }) => (
              <li key={party.id} className="flex items-center gap-1.5 text-sm">
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-sm border border-ink/20"
                  style={{ background: party.color }}
                />
                <span className="font-semibold">{party.shortName}</span>
                <span className="tnum font-bold">{count}</span>
                <span className="text-xs text-ink-faint">
                  ({formatNumber((count / total) * 100, 1)}%)
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            % sobre el total de alcaldías. Fuente: Corte Electoral, elecciones municipales
            2025 (agregación verificada automáticamente).
          </p>
        </div>
      </section>

      {/* Anclas por departamento */}
      <nav aria-label="Ir a un departamento" className="mt-8 flex flex-wrap gap-2">
        {departments
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, "es"))
          .map((d) => (
            <a
              key={d.id}
              href={`#${d.slug}`}
              className="pressable rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold text-ink-soft transition-colors hover:border-celeste hover:text-primary"
            >
              {d.name}
            </a>
          ))}
      </nav>

      {/* Tablas por departamento */}
      {departments
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((d) => {
          const munis = municipalitiesOf(d.id);
          if (munis.length === 0) return null;
          const hasNames = munis.some((m) => winnerOf(m.id)?.electedName);
          return (
            <section
              key={d.id}
              id={d.slug}
              aria-labelledby={`h-${d.slug}`}
              className="mt-10 scroll-mt-20"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`h-${d.slug}`} className="font-display text-2xl font-bold">
                  {d.name}
                  <span className="ml-2 text-base font-semibold text-ink-faint">
                    {munis.length} {munis.length === 1 ? "municipio" : "municipios"}
                  </span>
                </h2>
                <Link
                  className="text-sm font-semibold text-primary hover:underline"
                  href={`/departamentos/${d.slug}`}
                >
                  Ver perfil del departamento →
                </Link>
              </div>
              <TableWrap label={`Municipios de ${d.name}`} className="mt-3">
                <table className="tabla min-w-[480px]">
                  <caption className="sr-only">
                    Municipios de {d.name}: población, lema ganador y porcentaje en 2025
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Municipio</th>
                      <th scope="col" className="num">Población (2023)</th>
                      {hasNames ? <th scope="col">Alcalde/sa</th> : null}
                      <th scope="col">Lema ganador</th>
                      <th scope="col" className="num">% válidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {munis.map((m) => {
                      const w = winnerOf(m.id);
                      const party = w ? getParty(w.partyId) : undefined;
                      const pop = getLatest("poblacion", m.id);
                      return (
                        <tr key={m.id}>
                          <td>{m.name}</td>
                          <td className="num">
                            {pop?.obs.value ? formatNumber(pop.obs.value) : "—"}
                          </td>
                          {hasNames ? <td>{w?.electedName ?? "—"}</td> : null}
                          <td>
                            {party ? (
                              <PartyBadge color={party.color} name={party.shortName} />
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="num">
                            {w?.pct !== null && w?.pct !== undefined
                              ? `${formatNumber(w.pct, 1)}%`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          );
        })}

      <p className="mt-10 text-xs text-ink-faint">
        Población: Censo 2023 (INE; interior elaborado por el Observatorio Territorio
        Uruguay de OPP; Montevideo por cartografía censal). Los municipios creados en la
        expansión de 2025 todavía no tienen población censal agregada publicada.
        Resultados: Corte Electoral, <CatalogCredit sourceUrl={CONJUNTO_ELECCIONES_2025} />.
        Nombres de alcaldes y alcaldesas según las actas de proclamación de las Juntas
        Electorales Departamentales. Para el mapa de la capital, mirá{" "}
        <Link className="font-semibold text-primary hover:underline" href="/montevideo/municipios">
          Montevideo por municipios
        </Link>
        .
      </p>
    </div>
  );
}
