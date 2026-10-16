// Conjuntos del Catálogo Nacional de Datos Abiertos (catalogodatos.gub.uy) que
// usa el sitio. La Licencia de Datos Abiertos de Gobierno pide citar el
// conjunto con su nombre y un enlace directo, así que cada dato que venga del
// catálogo se reconoce por su URL y se cita con el conjunto de esta lista.
// scripts/validate-data.mjs falla si aparece una URL del catálogo que no esté
// acá: un conjunto nuevo se agrega con su nombre tal como figura en el catálogo.

export interface CatalogDataset {
  /** Identificador interno del catálogo (CKAN), el que suelen traer las URLs de descarga. */
  id: string;
  /** Nombre corto del conjunto en el catálogo: arma la URL de su página. */
  name: string;
  title: string;
  organization: string;
  /** Para qué lo usa el sitio, en una línea. */
  usedFor: string;
}

export const CATALOGO_NACIONAL = {
  name: "Catálogo Nacional de Datos Abiertos",
  url: "https://catalogodatos.gub.uy/",
};

export const LICENCIA_DAG = {
  name: "Licencia de Datos Abiertos de Gobierno de Uruguay",
  shortName: "Licencia DAG",
  url: "https://www.gub.uy/agencia-gobierno-electronico-sociedad-informacion-conocimiento/sites/agencia-gobierno-electronico-sociedad-informacion-conocimiento/files/documentos/publicaciones/licencia_de_datos_abiertos_0.pdf",
};

export const catalogDatasets: CatalogDataset[] = [
  {
    id: "7aaa1ff0-8ea5-4302-a3e6-c2d589b484a3",
    name: "corte-electoral-elecciones-nacionales-2024",
    title: "Elecciones Nacionales 2024",
    organization: "Corte Electoral",
    usedFor: "Resultados de la primera vuelta 2024 por departamento.",
  },
  {
    id: "2d5eb299-0d95-478b-9271-c62f601e7bc1",
    name: "corte-electoral-elecciones_departamentales_y_municipales_2025",
    title: "Elecciones Departamentales y Municipales 2025",
    organization: "Corte Electoral",
    usedFor: "Resultados 2025 por departamento y por municipio.",
  },
  {
    id: "999f2edc-5ef5-4d41-bed7-824a5635ea8d",
    name: "ministerio-del-interior-delitos_denunciados_en_el_uruguay",
    title: "Delitos denunciados en el Uruguay",
    organization: "Ministerio del Interior",
    usedFor: "Homicidios, rapiñas y hurtos por departamento.",
  },
];

// Páginas de los conjuntos que se citan a mano en textos de fuente.
export const CONJUNTO_ELECCIONES_2024 =
  "https://catalogodatos.gub.uy/dataset/corte-electoral-elecciones-nacionales-2024";
export const CONJUNTO_ELECCIONES_2025 =
  "https://catalogodatos.gub.uy/dataset/corte-electoral-elecciones_departamentales_y_municipales_2025";

export function catalogDatasetUrl(d: CatalogDataset): string {
  return `${CATALOGO_NACIONAL.url}dataset/${d.name}`;
}

/** El conjunto del catálogo al que pertenece una URL (página del conjunto o
 * descarga de uno de sus recursos), o undefined si no es del catálogo. */
export function getCatalogDataset(sourceUrl: string): CatalogDataset | undefined {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return undefined;
  }
  if (url.hostname !== "catalogodatos.gub.uy") return undefined;
  const m = /^\/dataset\/([^/]+)/.exec(url.pathname);
  if (!m) return undefined;
  return catalogDatasets.find((d) => d.id === m[1] || d.name === m[1]);
}

/** Enlace para "ver el dato": la página del conjunto si viene del catálogo (ahí
 * están los recursos, la licencia y los metadatos), si no la URL de origen. */
export function dataHref(sourceUrl: string): string {
  const d = getCatalogDataset(sourceUrl);
  return d ? catalogDatasetUrl(d) : sourceUrl;
}
