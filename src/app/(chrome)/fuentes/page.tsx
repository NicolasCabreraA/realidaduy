import type { Metadata } from "next";
import { sources } from "@/data/sources";
import { dictionary } from "@/data/dictionary";
import { getSource } from "@/data/sources";
import { StatusBadge } from "@/components/ui/Badge";
import {
  CATALOGO_NACIONAL,
  LICENCIA_DAG,
  catalogDatasetUrl,
  catalogDatasets,
} from "@/data/catalogo";
import { LIMITES_DEPARTAMENTOS_URL, LIMITES_MUNICIPIOS_URL } from "@/data/limites";
import TableWrap from "@/components/ui/TableWrap";

export const metadata: Metadata = {
  title: "Fuentes y metodología",
  description:
    "De dónde salen los datos de realidad.uy: organismos oficiales, diccionario de indicadores, tipos de dato y proceso de validación.",
};

const LEVEL_LABEL: Record<string, string> = {
  pais: "País",
  departamento: "Depto.",
  municipio: "Municipio",
};

const SECCIONES = [
  { id: "organismos", label: "Organismos" },
  { id: "catalogo", label: "Datos abiertos" },
  { id: "tipos", label: "Tipos de dato" },
  { id: "diccionario", label: "Diccionario" },
  { id: "validacion", label: "Validación" },
  { id: "geo", label: "Límites" },
];

const link = "font-semibold text-primary underline decoration-line underline-offset-2 hover:decoration-primary";

const PASOS_VALIDACION = [
  "Se verifica la fuente: organismo competente y URL del dato concreto.",
  "Se verifican el período y la unidad contra la publicación original.",
  "Se verifica el territorio (códigos ISO 3166-2 para departamentos).",
  "Los valores faltantes se declaran: nunca se rellenan con ceros ni estimaciones propias.",
  "Se detectan valores atípicos y se contrastan con la fuente.",
  "Se registran los cambios metodológicos (rediseño de la ECH 2021, nueva medición de pobreza 2025, cambio de base del PIB): las series no comparables nunca se empalman en silencio.",
  "Recién entonces el dato se publica como validado.",
];

export default function FuentesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
        Transparencia
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">
        Fuentes y metodología
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Ningún dato de esta plataforma es propio: todo proviene de fuentes públicas
        identificadas. Acá está el detalle de cada organismo, cada indicador y cómo se
        valida un dato antes de publicarse.
      </p>

      <nav aria-label="Secciones de esta página" className="mt-6 flex flex-wrap gap-2">
        {SECCIONES.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="pressable rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-celeste hover:text-primary"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* Organismos */}
      <section aria-labelledby="organismos-titulo" className="mt-12 scroll-mt-20" id="organismos">
        <h2 id="organismos-titulo" className="font-display text-2xl font-bold">Organismos fuente</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {sources.map((s) => (
            <article
              key={s.id}
              className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-celeste"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-lg bg-primary-soft px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide text-primary">
                  {s.shortName}
                </span>
                {s.type === "international" ? (
                  <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    Fuente secundaria
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 font-display text-lg font-bold leading-snug">{s.name}</h3>
              <p className="mt-1.5 flex-1 text-sm text-ink-soft">{s.provides}</p>
              <a
                className="pressable mt-4 inline-block self-start rounded-lg text-sm font-semibold text-primary group-hover:underline"
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Sitio oficial ↗
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* Catálogo Nacional de Datos Abiertos */}
      <section aria-labelledby="catalogo-titulo" className="mt-12 scroll-mt-20" id="catalogo">
        <h2 id="catalogo-titulo" className="font-display text-2xl font-bold">
          Conjuntos del Catálogo Nacional de Datos Abiertos
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Estos conjuntos están publicados en el{" "}
          <a className={link} href={CATALOGO_NACIONAL.url} target="_blank" rel="noopener noreferrer">
            {CATALOGO_NACIONAL.name}
          </a>{" "}
          y se usan bajo la{" "}
          <a className={link} href={LICENCIA_DAG.url} target="_blank" rel="noopener noreferrer">
            {LICENCIA_DAG.name}
          </a>
          . Cada dato del sitio que sale de uno de ellos cita el conjunto con su nombre y un
          enlace a su página en el catálogo.
        </p>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {catalogDatasets.map((d) => (
            <li key={d.id} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <a
                className="block font-display text-base font-bold leading-snug text-ink underline decoration-line underline-offset-2 hover:decoration-primary"
                href={catalogDatasetUrl(d)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {d.title}
              </a>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-faint">
                {d.organization}
              </p>
              <p className="mt-1.5 text-sm text-ink-soft">{d.usedFor}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Tipos de dato */}
      <section aria-labelledby="tipos-titulo" className="mt-12 scroll-mt-20" id="tipos">
        <h2 id="tipos-titulo" className="font-display text-2xl font-bold">Tipos de dato</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Cada observación declara qué clase de dato es; la etiqueta aparece junto a la
          cifra en toda la plataforma.
        </p>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <dt><StatusBadge status="OFFICIAL" /></dt>
            <dd className="mt-2 text-sm text-ink-soft">
              Publicado por el organismo oficial competente, sin transformación.
            </dd>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <dt><StatusBadge status="CALCULATED" /></dt>
            <dd className="mt-2 text-sm text-ink-soft">
              Derivado de datos oficiales con una fórmula documentada (p. ej. tasa de
              homicidios = víctimas ÷ población censal × 100.000).
            </dd>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <dt><StatusBadge status="SECONDARY" /></dt>
            <dd className="mt-2 text-sm text-ink-soft">
              Fuente internacional que reproduce o estima datos del país (Banco Mundial).
              Solo para evolución histórica, nunca para titulares si existe dato oficial.
            </dd>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <dt><StatusBadge status="UNAVAILABLE" /></dt>
            <dd className="mt-2 text-sm text-ink-soft">
              No existe dato público para ese territorio o período: la plataforma lo dice
              en lugar de estimar.
            </dd>
          </div>
        </dl>
      </section>

      {/* Diccionario */}
      <section aria-labelledby="diccionario-titulo" className="mt-12 scroll-mt-20" id="diccionario">
        <h2 id="diccionario-titulo" className="font-display text-2xl font-bold">Diccionario de indicadores</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Los {dictionary.filter((i) => i.status === "active").length} indicadores activos y
          los que están en preparación. Cada uno tiene su página con definición, metodología
          y ranking.
        </p>
        <TableWrap label="Diccionario de indicadores" className="mt-4">
          <table className="tabla min-w-[680px]">
            <caption className="sr-only">Diccionario de indicadores de la plataforma</caption>
            <thead>
              <tr>
                <th scope="col">Indicador</th>
                <th scope="col">Unidad</th>
                <th scope="col">Fuente</th>
                <th scope="col">Frecuencia</th>
                <th scope="col">Nivel</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {dictionary.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.unit}</td>
                  <td>{getSource(i.sourceId)?.shortName}</td>
                  <td>{i.periodicity}</td>
                  <td>
                    <span className="text-xs text-ink-soft">
                      {i.geographicLevel.map((l) => LEVEL_LABEL[l]).join(" · ")}
                    </span>
                  </td>
                  <td>
                    {i.status === "active" ? (
                      <span className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-block rounded-full border border-dashed border-line px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                        En preparación
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </section>

      {/* Validación */}
      <section aria-labelledby="validacion-titulo" className="mt-12 scroll-mt-20" id="validacion">
        <h2 id="validacion-titulo" className="font-display text-2xl font-bold">
          ¿Cómo se valida un dato antes de publicarse?
        </h2>
        <ol className="mt-5 space-y-0">
          {PASOS_VALIDACION.map((paso, i) => (
            <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
              {i < PASOS_VALIDACION.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-line"
                />
              ) : null}
              <span className="tnum z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-display text-sm font-bold text-primary shadow-card">
                {i + 1}
              </span>
              <p className="pt-1 text-sm text-ink-soft">{paso}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Límites territoriales */}
      <section aria-labelledby="geo-titulo" className="mt-12 scroll-mt-20" id="geo">
        <h2 id="geo-titulo" className="font-display text-2xl font-bold">Límites territoriales</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h3 className="font-display text-base font-bold">19 departamentos</h3>
            <p className="mt-1.5 text-sm text-ink-soft">
              <a className={link} href={LIMITES_DEPARTAMENTOS_URL} target="_blank" rel="noopener noreferrer">
                GeoJSON oficial de IDE Uruguay / Servicio Geográfico Militar
              </a>
              , que se publicó en el Catálogo Nacional bajo la {LICENCIA_DAG.name}. El
              conjunto ya no aparece en el listado del catálogo, pero el archivo sigue
              publicado. Geometría simplificada para la web: no usar para fines catastrales.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h3 className="font-display text-base font-bold">8 municipios de Montevideo</h3>
            <p className="mt-1.5 text-sm text-ink-soft">
              Derivados de la cartografía censal del INE (Censo 2023) agrupando los Centros
              Comunales Zonales según la correspondencia oficial de la Intendencia. El
              shapefile oficial de la IM estaba dañado en su servidor al momento de la
              ingesta (25/08/2026, documentado en el repositorio).
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card md:col-span-2">
            <h3 className="font-display text-base font-bold">136 municipios del país</h3>
            <p className="mt-1.5 text-sm text-ink-soft">
              <a className={link} href={LIMITES_MUNICIPIOS_URL} target="_blank" rel="noopener noreferrer">
                Capa oficial «Municipios» de la Dirección Nacional de Ordenamiento
                Territorial (MVOT)
              </a>
              , servida por el geoserver del Ministerio de Ambiente (WFS) y actualizada al
              18/09/2025. Construida a partir de las Series Electorales
              2025 en cooperación entre IDEuy y la Corte Electoral (Circular Nº 12208).
              Los municipios no cubren todo el territorio: las zonas rurales sin municipio
              se muestran en blanco en el mapa. Geometría simplificada para la web: no usar
              para fines catastrales.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
