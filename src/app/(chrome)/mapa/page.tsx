import type { Metadata } from "next";
import Link from "next/link";
import MapExplorer from "@/components/map/MapExplorer";
import MapSources from "@/components/map/MapSources";
import CatalogCredit from "@/components/ui/CatalogCredit";
import { CONJUNTO_ELECCIONES_2025, LICENCIA_DAG } from "@/data/catalogo";
import { LIMITES_DEPARTAMENTOS_URL } from "@/data/limites";
import { departmentSummaries } from "@/lib/data/summaries";

export const metadata: Metadata = {
  title: "Explorá Uruguay — Mapa interactivo",
  description:
    "Mapa interactivo de los 19 departamentos de Uruguay: población del Censo 2023 y partido de gobierno de cada departamento.",
};

export default function MapaPage() {
  const territories = departmentSummaries();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">Explorá Uruguay</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Elegí qué mostrar con los botones de arriba del mapa y tocá un departamento para ver
        su resumen completo.
      </p>

      <nav aria-label="Nivel territorial" className="mt-4 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card">
        <span
          aria-current="page"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white"
        >
          Departamentos
        </span>
        <Link
          href="/mapa/municipios"
          className="pressable rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:text-primary"
        >
          Municipios
        </Link>
      </nav>

      <div className="mt-6">
        <MapExplorer
          territories={territories}
          geoUrl="/geo/departamentos.json"
          profileBase="/departamentos"
          mapTitle="Mapa de los 19 departamentos de Uruguay"
        />
      </div>
      <MapSources
        territories={territories}
        territoryNoun="departamentos"
        gobierno={
          <>
            resultados de las elecciones departamentales 2025 del{" "}
            <CatalogCredit sourceUrl={CONJUNTO_ELECCIONES_2025} />.
          </>
        }
        limites={
          <>
            <a
              className="underline decoration-line underline-offset-2 hover:decoration-primary"
              href={LIMITES_DEPARTAMENTOS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              archivo de límites departamentales de IDE Uruguay / Servicio Geográfico Militar
            </a>
            , que se publicó en el Catálogo Nacional bajo la{" "}
            <a
              className="underline decoration-line underline-offset-2 hover:decoration-primary"
              href={LICENCIA_DAG.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {LICENCIA_DAG.name}
            </a>
            . El conjunto ya no aparece en el listado del catálogo, pero el archivo sigue
            publicado. Geometría simplificada para la web.
          </>
        }
      />
    </div>
  );
}
