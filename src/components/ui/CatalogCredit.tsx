import {
  CATALOGO_NACIONAL,
  LICENCIA_DAG,
  catalogDatasetUrl,
  getCatalogDataset,
} from "@/data/catalogo";

const link = "underline decoration-line underline-offset-2 hover:decoration-primary";

/** Cita de un conjunto del Catálogo Nacional, como pide la Licencia DAG:
 * nombre del conjunto con enlace directo, el catálogo y la licencia.
 * `sourceUrl` es cualquier URL del conjunto (su página o una descarga). */
export default function CatalogCredit({ sourceUrl }: { sourceUrl: string }) {
  const d = getCatalogDataset(sourceUrl);
  if (!d) return null;
  return (
    <>
      conjunto «
      <a className={link} href={catalogDatasetUrl(d)} target="_blank" rel="noopener noreferrer">
        {d.title}
      </a>
      » ({d.organization}) del{" "}
      <a className={link} href={CATALOGO_NACIONAL.url} target="_blank" rel="noopener noreferrer">
        {CATALOGO_NACIONAL.name}
      </a>
      , bajo la{" "}
      <a className={link} href={LICENCIA_DAG.url} target="_blank" rel="noopener noreferrer">
        {LICENCIA_DAG.name}
      </a>
    </>
  );
}
