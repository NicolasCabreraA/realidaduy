import type { Metadata } from "next";
import {
  elections,
  electionResults,
  getElectionResults,
  getParty,
  turnout,
} from "@/data/elections";
import { historicElections } from "@/data/elecciones-historicas";
import { departments, montevideoMunicipalities } from "@/data/territories";
import { formatNumber } from "@/lib/format";
import { PartyBadge } from "@/components/ui/Badge";
import { CategoricalLegend } from "@/components/map/MapLegend";
import ChoroplethMap from "@/components/map/ChoroplethMap";
import PartyBars from "@/components/charts/PartyBars";
import ShareButton from "@/components/share/ShareButton";
import EmbedButton from "@/components/embed/EmbedButton";
import CatalogCredit from "@/components/ui/CatalogCredit";
import { CONJUNTO_ELECCIONES_2024, CONJUNTO_ELECCIONES_2025 } from "@/data/catalogo";

export const metadata: Metadata = {
  title: "¿Cómo votó Uruguay?",
  description:
    "Resultados electorales de Uruguay: elección nacional 2024 por departamento, balotaje, departamentales y municipales 2025, e historia electoral desde 1984.",
};

const GRAY = "#8A8A8A";
const partyColor = (partyId: string | null) => (partyId ? getParty(partyId)?.color ?? GRAY : GRAY);

export default function EleccionesPage() {
  const nacional = getElectionResults("nacional-2024", "UY").sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const balotaje = getElectionResults("balotaje-2024", "UY").sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const presidenteElecto = balotaje.find((r) => r.winner);

  const nacionalRows = nacional.map((r) => {
    const p = getParty(r.partyId)!;
    return { name: p.name, color: p.color, pct: r.pct ?? 0, votes: r.votes };
  });
  const sumaConocida = nacionalRows.reduce((s, r) => s + r.pct, 0);
  const otros = Math.max(0, 100 - sumaConocida);

  // Ganador de la primera vuelta 2024 en cada departamento (datos oficiales).
  const dept2024 = departments.map((d) => {
    const winner = electionResults.find(
      (r) => r.electionId === "nacional-2024" && r.territoryId === d.id && r.winner
    );
    const party = winner ? getParty(winner.partyId) : undefined;
    return { dept: d, winner, party };
  });
  const dept2024Entries = Object.fromEntries(
    dept2024.map(({ dept, winner, party }) => [
      dept.id,
      {
        fill: party?.color ?? "var(--color-line)",
        label: dept.name,
        sublabel: party
          ? `${party.name}: ${formatNumber(winner?.pct ?? 0, 2)}% de los votos emitidos`
          : "Sin datos",
      },
    ])
  );
  const dept2024Parties = [...new Map(
    dept2024.filter((w) => w.party).map((w) => [w.party!.id, { color: w.party!.color, label: w.party!.name }])
  ).values()];

  const deptWinners = departments.map((d) => {
    const winner = electionResults.find(
      (r) => r.electionId === "departamental-2025" && r.territoryId === d.id && r.winner
    );
    const party = winner ? getParty(winner.partyId) : undefined;
    return { dept: d, winner, party };
  });
  const deptEntries = Object.fromEntries(
    deptWinners.map(({ dept, winner, party }) => [
      dept.id,
      {
        fill: party?.color ?? "var(--color-line)",
        label: dept.name,
        sublabel: party
          ? `${party.name} · ${winner?.electedName ?? ""} (${formatNumber(winner?.pct ?? 0, 1)}% de los válidos)`
          : "Sin datos",
      },
    ])
  );
  const deptParties = [...new Map(
    deptWinners.filter((w) => w.party).map((w) => [w.party!.id, { color: w.party!.color, label: w.party!.name }])
  ).values()];

  const muniWinners = montevideoMunicipalities.map((m) => {
    const winner = electionResults.find(
      (r) => r.electionId === "municipal-2025" && r.territoryId === m.id && r.winner
    );
    const party = winner ? getParty(winner.partyId) : undefined;
    return { muni: m, winner, party };
  });
  const muniEntries = Object.fromEntries(
    muniWinners.map(({ muni, winner, party }) => [
      muni.id,
      {
        fill: party?.color ?? "var(--color-line)",
        label: muni.name,
        sublabel: party
          ? `${party.name} · ${winner?.electedName ?? ""} (${formatNumber(winner?.pct ?? 0, 1)}% de los válidos)`
          : "Sin datos",
      },
    ])
  );
  const muniParties = [...new Map(
    muniWinners.filter((w) => w.party).map((w) => [w.party!.id, { color: w.party!.color, label: w.party!.name }])
  ).values()];

  const turnoutFor = (id: string) => turnout.find((t) => t.electionId === id)?.pct;
  const eleccion2024 = elections.find((e) => e.id === "nacional-2024")!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">¿Cómo votó Uruguay?</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Resultados oficiales, sin interpretación: números, mapas y fuentes. Las conclusiones
        las sacás vos.
      </p>

      {/* Nacional 2024 */}
      <section aria-labelledby="nacional-2024" className="mt-8">
        <figure data-share-card className="rounded-2xl border border-line bg-surface p-4 shadow-card md:p-5">
          <div className="flex items-start justify-between gap-3">
            <figcaption className="min-w-0">
              <h2 id="nacional-2024" className="font-display text-2xl font-bold">
                Elección nacional 2024 — primera vuelta
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                27 de octubre de 2024 · Porcentajes sobre el total de votos emitidos ·
                Participación: {formatNumber(turnoutFor("nacional-2024") ?? 0, 2)}% de los
                habilitados
              </p>
            </figcaption>
            <ShareButton
              filename="eleccion-nacional-2024"
              title="Elección nacional 2024 — primera vuelta"
            />
          </div>
          <div className="mt-4">
            <PartyBars
              rows={[
                ...nacionalRows,
                { name: "Otros, en blanco y anulados", color: GRAY, pct: otros, votes: null },
              ]}
            />
          </div>
          <details data-no-export className="fold mt-3">
            <summary className="pressable inline-block rounded-lg text-sm font-semibold text-primary">
              Ver datos
            </summary>
            <div className="tablewrap mt-2">
              <table className="tabla min-w-[360px]">
                <caption className="sr-only">Resultados de la primera vuelta 2024</caption>
                <thead>
                  <tr>
                    <th scope="col">Partido</th>
                    <th scope="col" className="num">Votos</th>
                    <th scope="col" className="num">% del total emitido</th>
                  </tr>
                </thead>
                <tbody>
                  {nacionalRows.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className="num">{r.votes ? formatNumber(r.votes) : "—"}</td>
                      <td className="num">{formatNumber(r.pct, 2)}%</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Otros, en blanco y anulados</td>
                    <td className="num">—</td>
                    <td className="num">{formatNumber(otros, 2)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
          <p className="mt-3 text-xs text-ink-faint">
            Fuente: Corte Electoral (
            <a className="underline" href={eleccion2024.sourceUrl} target="_blank" rel="noopener noreferrer">
              resultados oficiales
            </a>
            ); por departamento, <CatalogCredit sourceUrl={CONJUNTO_ELECCIONES_2024} />. Los
            porcentajes se expresan sobre el total de votos emitidos (la forma en que se
            difundieron públicamente); &quot;Otros, en blanco y anulados&quot; es el resto hasta
            el 100%.
          </p>
        </figure>
      </section>

      {/* Nacional 2024 por departamento */}
      <section aria-labelledby="nacional-2024-dept" className="mt-6">
        <figure data-share-card className="rounded-2xl border border-line bg-surface p-4 shadow-card md:p-5">
          <div className="flex items-start justify-between gap-3">
            <figcaption className="min-w-0">
              <h2 id="nacional-2024-dept" className="font-display text-2xl font-bold">
                ¿Qué partido fue el más votado en cada departamento?
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                Primera vuelta 2024 · Calculado desde el desglose oficial por circuito de la
                Corte Electoral · % sobre votos emitidos en cada departamento
              </p>
            </figcaption>
            <ShareButton
              filename="mapa-primera-vuelta-2024"
              title="Partido más votado por departamento, primera vuelta 2024"
            />
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <ChoroplethMap
                geoUrl="/geo/departamentos.json"
                entries={dept2024Entries}
                title="Partido más votado en la primera vuelta 2024 por departamento"
              />
              <div className="mt-3">
                <CategoricalLegend items={dept2024Parties} title="Partido más votado" />
              </div>
            </div>
            <div className="tablewrap">
              <table className="tabla">
                <caption className="sr-only">Partido más votado por departamento, primera vuelta 2024</caption>
                <thead>
                  <tr>
                    <th scope="col">Departamento</th>
                    <th scope="col">Más votado</th>
                    <th scope="col" className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {dept2024.map(({ dept, winner, party }) => (
                    <tr key={dept.id}>
                      <td>{dept.name}</td>
                      <td>{party ? <PartyBadge color={party.color} name={party.shortName} /> : "—"}</td>
                      <td className="num">
                        {winner?.pct !== null && winner?.pct !== undefined
                          ? `${formatNumber(winner.pct, 1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Los totales nacionales de esta agregación coinciden exactamente con el
            escrutinio oficial (verificación automática en cada ingesta). El detalle por
            partido de cada departamento está en su perfil.
          </p>
        </figure>
      </section>

      {/* Balotaje */}
      <section aria-labelledby="balotaje" className="mt-6">
        <figure data-share-card className="rounded-2xl border border-line bg-surface p-4 shadow-card md:p-5">
          <div className="flex items-start justify-between gap-3">
            <figcaption className="min-w-0">
              <h2 id="balotaje" className="font-display text-2xl font-bold">Balotaje 2024</h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                24 de noviembre de 2024 · Porcentajes sobre votos válidos (escrutinio
                definitivo) · Participación: {formatNumber(turnoutFor("balotaje-2024") ?? 0, 2)}%
              </p>
            </figcaption>
            <ShareButton filename="balotaje-2024" title="Balotaje 2024" />
          </div>
          <div className="mt-4">
            <PartyBars
              rows={balotaje.map((r) => {
                const p = getParty(r.partyId)!;
                return {
                  name: `${r.electedName} (${p.shortName})`,
                  color: p.color,
                  pct: r.pct ?? 0,
                  votes: r.votes,
                };
              })}
            />
          </div>
          {presidenteElecto ? (
            <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-sm">
              Fórmula ganadora: <strong>{presidenteElecto.electedName}</strong> (
              {getParty(presidenteElecto.partyId)?.name}), con{" "}
              <span className="tnum">{formatNumber(presidenteElecto.votes ?? 0)}</span> votos.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-ink-faint">
            Los porcentajes sobre el total de votos emitidos (incluye en blanco y anulados)
            son distintos: 49,84% y 45,87%. Esta plataforma nunca mezcla las dos bases en un
            mismo gráfico.
          </p>
        </figure>
      </section>

      {/* Departamentales 2025 */}
      <section aria-labelledby="departamentales-2025" className="mt-6">
        <figure data-share-card className="rounded-2xl border border-line bg-surface p-4 shadow-card md:p-5">
          <div className="flex items-start justify-between gap-3">
            <figcaption className="min-w-0">
              <h2 id="departamentales-2025" className="font-display text-2xl font-bold">
                Departamentales 2025: ¿qué partido gobierna cada departamento?
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                11 de mayo de 2025 · Participación: {formatNumber(turnoutFor("departamental-2025") ?? 0, 2)}% ·
                Balance: PN 13 · FA 4 · PC 1 · CR 1 · % sobre votos válidos al lema
              </p>
            </figcaption>
            <div data-no-export className="flex shrink-0 items-center gap-2">
              <EmbedButton
                title="Partido de gobierno departamental"
                options={[{ label: "Mapa", path: "/embed/mapa/gobierno", height: 660 }]}
              />
              <ShareButton
                filename="departamentales-2025"
                title="Departamentales 2025: partido de gobierno por departamento"
              />
            </div>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <ChoroplethMap
                geoUrl="/geo/departamentos.json"
                entries={deptEntries}
                title="Partido ganador de la elección departamental 2025 en cada departamento"
              />
              <div className="mt-3">
                <CategoricalLegend items={deptParties} title="Lema ganador" />
              </div>
            </div>
            <div className="tablewrap">
              <table className="tabla min-w-[380px]">
                <caption className="sr-only">Intendentes electos por departamento, 2025</caption>
                <thead>
                  <tr>
                    <th scope="col">Departamento</th>
                    <th scope="col">Intendente</th>
                    <th scope="col">Partido</th>
                    <th scope="col" className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {deptWinners.map(({ dept, winner, party }) => (
                    <tr key={dept.id}>
                      <td>{dept.name}</td>
                      <td>{winner?.electedName ?? "—"}</td>
                      <td>{party ? <PartyBadge color={party.color} name={party.shortName} /> : "—"}</td>
                      <td className="num">
                        {winner?.pct !== null && winner?.pct !== undefined
                          ? `${formatNumber(winner.pct, 1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Fuente: Corte Electoral (desglose oficial por circuito, agregado y verificado
            automáticamente contra los lemas ganadores),{" "}
            <CatalogCredit sourceUrl={CONJUNTO_ELECCIONES_2025} />. El detalle completo por
            partido está en el perfil de cada departamento.
          </p>
        </figure>
      </section>

      {/* Municipales 2025 MVD */}
      <section aria-labelledby="municipales-2025" className="mt-6">
        <figure data-share-card className="rounded-2xl border border-line bg-surface p-4 shadow-card md:p-5">
          <div className="flex items-start justify-between gap-3">
            <figcaption className="min-w-0">
              <h2 id="municipales-2025" className="font-display text-2xl font-bold">
                Municipales 2025: los 8 municipios de Montevideo
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                11 de mayo de 2025 · Balance: FA 6 · CR 2 · % sobre votos válidos al lema
              </p>
            </figcaption>
            <ShareButton
              filename="municipales-montevideo-2025"
              title="Municipales 2025: los 8 municipios de Montevideo"
            />
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <ChoroplethMap
                geoUrl="/geo/municipios-montevideo.json"
                entries={muniEntries}
                title="Partido ganador de la elección municipal 2025 en cada municipio de Montevideo"
              />
              <div className="mt-3">
                <CategoricalLegend items={muniParties} title="Lema ganador" />
              </div>
            </div>
            <div className="tablewrap">
              <table className="tabla min-w-[380px]">
                <caption className="sr-only">Alcaldes electos por municipio de Montevideo, 2025</caption>
                <thead>
                  <tr>
                    <th scope="col">Municipio</th>
                    <th scope="col">Alcalde/sa</th>
                    <th scope="col">Partido</th>
                    <th scope="col" className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {muniWinners.map(({ muni, winner, party }) => (
                    <tr key={muni.id}>
                      <td>{muni.name}</td>
                      <td>{winner?.electedName ?? "—"}</td>
                      <td>{party ? <PartyBadge color={party.color} name={party.shortName} /> : "—"}</td>
                      <td className="num">
                        {winner?.pct !== null && winner?.pct !== undefined
                          ? `${formatNumber(winner.pct, 1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Fuente: Corte Electoral (desglose oficial por circuito),{" "}
            <CatalogCredit sourceUrl={CONJUNTO_ELECCIONES_2025} />. En el Municipio F la
            definición llegó tras el escrutinio de votos observados: FA 19.590 vs CR 19.009
            (581 votos de diferencia).
          </p>
        </figure>
      </section>

      {/* Historia electoral 1984–2019 */}
      <section aria-labelledby="historico" className="mt-10">
        <h2 id="historico" className="font-display text-2xl font-bold">
          Historia electoral (1984–2019)
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Todas las elecciones nacionales desde el retorno a la democracia. Porcentajes de
          primera vuelta sobre votos válidos. Tocá un año para ver el detalle.
        </p>
        <div className="mt-4 space-y-3">
          {historicElections.map((e) => {
            const winner = e.firstRound[0];
            return (
              <details key={e.year} data-share-card className="fold rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
                <summary className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-display text-xl font-bold">{e.year}</span>
                  <PartyBadge color={partyColor(e.president.partyId)} name={e.president.label} />
                  <span className="text-sm text-ink-soft">
                    Presidente electo: <strong className="text-ink">{e.president.name}</strong>
                  </span>
                  <span className="tnum ml-auto text-sm text-ink-faint">
                    1ª vuelta: {winner.label} {formatNumber(winner.pct, 2)}%
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="-mb-2 flex justify-end">
                    <ShareButton
                      filename={`eleccion-nacional-${e.year}`}
                      title={`Elección nacional ${e.year}`}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-ink-faint">
                      Primera vuelta · {e.date.split("-").reverse().join("/")} · participación{" "}
                      {formatNumber(e.turnout, 2)}%
                    </h3>
                    <div className="mt-2">
                      <PartyBars
                        compact
                        rows={e.firstRound.map((r) => ({
                          name: r.label,
                          color: partyColor(r.partyId),
                          pct: r.pct,
                        }))}
                      />
                    </div>
                  </div>
                  {e.runoff ? (
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-faint">
                        Balotaje · {e.runoff.date.split("-").reverse().join("/")}
                        {e.runoff.turnout ? ` · participación ${formatNumber(e.runoff.turnout, 2)}%` : ""}
                        {" · % sobre votos "}
                        {e.runoff.pctBase === "validos" ? "válidos" : "emitidos"}
                      </h3>
                      <div className="mt-2">
                        <PartyBars
                          compact
                          rows={e.runoff.candidates.map((c) => ({
                            name: `${c.name} (${c.label})`,
                            color: partyColor(c.partyId),
                            pct: c.pct,
                          }))}
                        />
                      </div>
                      {e.runoff.note ? (
                        <p className="mt-1 text-xs text-ink-faint">{e.runoff.note}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-faint">Sin balotaje.</p>
                  )}
                  <p className="text-xs text-ink-faint">
                    Fuente:{" "}
                    <a className="underline" href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
                      Wikipedia (reproduce datos de la Corte Electoral)
                    </a>
                    . Pendiente de cotejo final contra las publicaciones oficiales.
                  </p>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
