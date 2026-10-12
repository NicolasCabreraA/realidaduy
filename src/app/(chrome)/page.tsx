import Link from "next/link";
import MetricCard from "@/components/charts/MetricCard";
import HeroMap from "@/components/map/HeroMap";
import PartyBars from "@/components/charts/PartyBars";
import Reveal from "@/components/ui/Reveal";
import { TextureLink } from "@/components/cult/TextureButton";
import { getElectionResults, getParty } from "@/data/elections";

const HOY = [
  "tasa-desempleo",
  "inflacion-interanual",
  "dolar",
  "pobreza-personas",
  "pib-variacion",
  "poblacion",
  "salario-minimo",
  "indice-medio-salarios",
];

export default function Home() {
  const balotaje = getElectionResults("balotaje-2024", "UY")
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    .map((r) => {
      const p = getParty(r.partyId)!;
      return { name: `${r.electedName} (${p.shortName})`, color: p.color, pct: r.pct ?? 0 };
    });
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-primary to-primary-hover text-white">
        <div aria-hidden className="dot-grid absolute inset-0" />
        <div
          aria-hidden
          className="absolute -right-32 top-1/2 h-[36rem] w-[36rem] -translate-y-1/2 rounded-full bg-celeste/15 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-12 md:px-6 md:py-20">
          <div className="md:col-span-7">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-celeste-soft">
                Entendé Uruguay, territorio por territorio
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-3 max-w-2xl font-display text-5xl font-extrabold tracking-tight md:text-7xl">
                Uruguay, <span className="hero-accent">en datos.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-5 max-w-xl text-lg text-white/85 md:text-xl">
                La realidad política, económica y social del país, con datos públicos
                verificables: cada cifra muestra su fuente y su metodología.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <TextureLink href="/mapa" variant="inverse">
                  Explorá el mapa
                </TextureLink>
                <Link
                  href="/elecciones"
                  className="rounded-[10px] border border-white/40 px-5 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-white/10 md:text-base"
                >
                  ¿Cómo votó Uruguay?
                </Link>
              </div>
            </Reveal>
          </div>
          <div className="md:col-span-5">
            <HeroMap className="mx-auto max-w-xs md:max-w-sm" />
          </div>
        </div>
      </section>

      <p className="mx-auto max-w-6xl px-4 pt-6 text-center text-sm text-ink-faint md:px-6">
        Plataforma ciudadana independiente, sin afiliación partidaria, hecha con datos abiertos.
      </p>

      <section aria-labelledby="uruguay-hoy" className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="uruguay-hoy" className="font-display text-2xl font-bold md:text-3xl">
            Uruguay hoy
          </h2>
          <p className="text-sm text-ink-faint">
            Último dato disponible por indicador. Tocá una tarjeta para ver detalle y fuente.
          </p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOY.map((id, i) => (
            <Reveal
              key={id}
              delay={Math.min(i * 0.05, 0.3)}
              className={i === 0 ? "sm:col-span-2 lg:col-span-2" : ""}
            >
              <MetricCard indicatorId={id} featured={i === 0} />
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-label="Secciones principales" className="mx-auto max-w-6xl px-4 pb-14 md:px-6">
        <div className="grid gap-4 md:grid-cols-5">
          <Reveal className="md:col-span-3">
            <Link
              href="/elecciones"
              className="group flex h-full flex-col justify-between rounded-2xl border border-line bg-celeste-soft/50 p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-celeste md:p-8"
            >
              <div>
                <h3 className="font-display text-2xl font-bold text-ink md:text-3xl">
                  ¿Cómo votó Uruguay?
                </h3>
                <p className="mt-2 max-w-md text-ink-soft">
                  Resultados de 2024 y 2025, con mapa por partido ganador y datos
                  completos de cada departamento.
                </p>
                <div className="mt-4 max-w-md">
                  <PartyBars compact rows={balotaje} />
                  <p className="mt-1.5 text-xs text-ink-faint">
                    Balotaje 2024 · % sobre votos válidos · Corte Electoral
                  </p>
                </div>
              </div>
              <p className="mt-6 font-display font-semibold text-primary group-hover:underline">
                Ver elecciones →
              </p>
            </Link>
          </Reveal>
          <Reveal delay={0.08} className="md:col-span-2">
            <Link
              href="/comparar"
              className="group flex h-full flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-celeste"
            >
              <div>
                <h3 className="font-display text-xl font-bold text-ink">Compará territorios</h3>
                <p className="mt-2 text-sm text-ink-soft">
                  Elegí hasta tres departamentos o municipios y miralos lado a lado.
                </p>
              </div>
              <p className="mt-6 font-display font-semibold text-primary group-hover:underline">
                Ir al comparador →
              </p>
            </Link>
          </Reveal>
          <Reveal delay={0.12} className="md:col-span-5">
            <Link
              href="/montevideo/municipios"
              className="group flex flex-col items-start justify-between gap-4 rounded-2xl bg-primary p-6 text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover md:flex-row md:items-center"
            >
              <div>
                <h3 className="font-display text-xl font-bold">
                  Montevideo, municipio por municipio
                </h3>
                <p className="mt-1 text-sm text-white/80">
                  Los 8 municipios de la capital: gobierno, población y comparaciones.
                </p>
              </div>
              <p className="shrink-0 font-display font-semibold text-celeste group-hover:underline">
                Ver municipios →
              </p>
            </Link>
          </Reveal>
        </div>
      </section>

      <section aria-label="Fuentes y metodología" className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-10 md:flex-row md:items-center md:px-6">
          <div>
            <h2 className="font-display text-xl font-bold">Cada cifra con su fuente</h2>
            <p className="mt-1 text-sm text-ink-soft">
              INE, BCU, Corte Electoral y más: mirá de dónde sale cada dato y cómo se calcula.
            </p>
          </div>
          <TextureLink href="/fuentes" variant="secondary" className="shrink-0">
            Ver fuentes y metodología
          </TextureLink>
        </div>
      </section>
    </>
  );
}
