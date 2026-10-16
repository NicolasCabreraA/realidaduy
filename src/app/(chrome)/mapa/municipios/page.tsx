import type { Metadata } from "next";
import Link from "next/link";
import MapExplorer from "@/components/map/MapExplorer";
import MapSources from "@/components/map/MapSources";
import CatalogCredit from "@/components/ui/CatalogCredit";
import { CONJUNTO_ELECCIONES_2025 } from "@/data/catalogo";
import { LIMITES_MUNICIPIOS_URL } from "@/data/limites";
import { allMunicipioSummaries } from "@/lib/data/summaries";

export const metadata: Metadata = {
  title: "Mapa de los 136 municipios",
  description:
    "Mapa interactivo de los 136 municipios de Uruguay: población, indicadores censales y partido de gobierno de cada municipio, con límites oficiales de DINOT/MVOT.",
};

export default function MapaMunicipiosPage() {
  const territories = allMunicipioSummaries();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">Explorá Uruguay</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Los 136 municipios del país. Elegí qué mostrar con los botones y tocá un municipio
        para ver su resumen.
      </p>

      <nav aria-label="Nivel territorial" className="mt-4 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card">
        <Link
          href="/mapa"
          className="pressable rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:text-primary"
        >
          Departamentos
        </Link>
        <span
          aria-current="page"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white"
        >
          Municipios
        </span>
      </nav>

      <div className="mt-6">
        <MapExplorer
          territories={territories}
          geoUrl="/geo/municipios.json"
          backdropUrl="/geo/departamentos.json"
          profileBase={null}
          mapTitle="Mapa de los 136 municipios de Uruguay"
          showCodes={false}
        />
      </div>
      <MapSources
        territories={territories}
        territoryNoun="municipios"
        gobierno={
          <>
            resultados de las elecciones municipales 2025 del{" "}
            <CatalogCredit sourceUrl={CONJUNTO_ELECCIONES_2025} />. Nombres de alcaldes y
            alcaldesas según las actas de proclamación de las Juntas Electorales
            Departamentales.
          </>
        }
        limites={
          <>
            <a
              className="underline decoration-line underline-offset-2 hover:decoration-primary"
              href={LIMITES_MUNICIPIOS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              capa oficial «Municipios» de DINOT (Ministerio de Vivienda y Ordenamiento
              Territorial)
            </a>{" "}
            (descarga directa en GeoJSON), publicada por el Ministerio de Ambiente y construida desde las Series
            Electorales 2025 (IDEuy y Corte Electoral, Circular Nº 12208). Geometría
            simplificada para la web.
          </>
        }
      >
        <p className="mt-3 text-sm text-ink-soft">
          Las zonas en blanco dentro de cada departamento no integran ningún municipio: es
          la situación real de parte del territorio rural, no un dato faltante.
        </p>
      </MapSources>
    </div>
  );
}
