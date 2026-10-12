import type { Observation, Source } from "@/lib/types";

export const sources: Source[] = [
  {
    id: "ine",
    name: "Instituto Nacional de Estadística",
    shortName: "INE",
    url: "https://www.gub.uy/instituto-nacional-estadistica/",
    type: "official",
    provides:
      "Empleo, desempleo, ingresos y pobreza (ECH), inflación (IPC), salarios (IMS) y Censo 2023.",
  },
  {
    id: "bcu",
    name: "Banco Central del Uruguay",
    shortName: "BCU",
    url: "https://www.bcu.gub.uy/",
    type: "official",
    provides: "PIB y cuentas nacionales trimestrales, sector externo, tipo de cambio.",
  },
  {
    id: "corte-electoral",
    name: "Corte Electoral",
    shortName: "Corte Electoral",
    url: "https://www.gub.uy/corte-electoral/",
    type: "official",
    provides: "Resultados de elecciones nacionales, departamentales y municipales; participación.",
  },
  {
    id: "mtss",
    name: "Ministerio de Trabajo y Seguridad Social",
    shortName: "MTSS",
    url: "https://www.gub.uy/ministerio-trabajo-seguridad-social/",
    type: "official",
    provides: "Salario mínimo nacional (decretos).",
  },
  {
    id: "mi",
    name: "Ministerio del Interior",
    shortName: "M. Interior",
    url: "https://www.gub.uy/ministerio-interior/",
    type: "official",
    provides:
      "Delitos denunciados (homicidios, rapiñas, hurtos) — microdatos abiertos 2013→presente, actualizados trimestralmente.",
  },
  {
    id: "opp",
    name: "Oficina de Planeamiento y Presupuesto — Observatorio Territorio Uruguay",
    shortName: "OPP",
    url: "https://www.opp.gub.uy/",
    type: "official",
    provides: "Indicadores territoriales por departamento y municipio.",
  },
  {
    id: "mides",
    name: "Ministerio de Desarrollo Social — Observatorio Social",
    shortName: "MIDES",
    url: "https://www.gub.uy/ministerio-desarrollo-social/",
    type: "official",
    provides:
      "Ingreso medio de los hogares y pobreza por departamento (elaboraciones sobre la ECH del INE).",
  },
  {
    id: "prisma",
    name: "PRISMA — Portal de indicadores de ciencia, tecnología e innovación (ANII)",
    shortName: "PRISMA (ANII)",
    url: "https://prisma.uy/",
    type: "official",
    provides:
      "PBI anual 2006–2016 a precios constantes de 2016 (dato del BCU). Datos públicos: se usan citando el portal.",
  },
  {
    id: "banco-mundial",
    name: "Banco Mundial — Indicadores de Desarrollo Mundial",
    shortName: "Banco Mundial",
    url: "https://datos.bancomundial.org/pais/uruguay",
    type: "international",
    provides:
      "Series históricas anuales comparables (PIB per cápita, inflación, desempleo OIT). Fuente secundaria: se usa solo para evolución histórica y siempre se etiqueta como tal.",
  },
];

export function getSource(id: string): Source | undefined {
  return sources.find((s) => s.id === id);
}

// Datos que no pertenecen al organismo del indicador, reconocidos por su URL
// (host + ruta). La serie histórica del Banco Mundial vive dentro de
// indicadores del INE, y no se le puede atribuir al INE. El PBI anual que
// publica PRISMA es del BCU, pero la condición de uso es citar el portal. El
// desempleo y la pobreza por departamento son elaboraciones del Observatorio
// Territorio Uruguay (OPP) y el ingreso de los hogares, del MIDES: todos sobre
// la ECH, pero el número publicado es de ellos. En gub.uy todos los
// organismos comparten host, por eso se compara también la ruta.
const SOURCE_BY_URL: Array<[RegExp, string]> = [
  [/^([^/]+\.)?worldbank\.org\//i, "banco-mundial"],
  [/^([^/]+\.)?bancomundial\.org\//i, "banco-mundial"],
  [/^([^/]+\.)?prisma\.uy\//i, "prisma"],
  [/^otu\.opp\.gub\.uy\//i, "opp"],
  [/^www\.gub\.uy\/ministerio-desarrollo-social\//i, "mides"],
];

/** Fuente a citar para una observación: la de su URL si coincide con
 * SOURCE_BY_URL, si no la del indicador. */
export function getObservationSource(
  indicatorSourceId: string | undefined,
  obs: Observation
): Source | undefined {
  try {
    const url = new URL(obs.sourceUrl);
    const match = SOURCE_BY_URL.find(([re]) => re.test(url.hostname + url.pathname));
    if (match) return getSource(match[1]);
  } catch {
    // sourceUrl mal formada: se cae al organismo del indicador.
  }
  return indicatorSourceId ? getSource(indicatorSourceId) : undefined;
}
