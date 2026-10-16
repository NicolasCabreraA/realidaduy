import type { Observation } from "@/lib/types";

// Población por departamento — Censo 2023, resultados finales (INE).
// Verificación por consistencia: la suma de los 19 departamentos da exactamente
// 3.499.451, igual al total oficial publicado por INE/OPP/Presidencia.
// Tabla 1 del informe (página 4): población por departamento.
const CENSUS_SOURCE =
  "https://www5.ine.gub.uy/documents/CENSO%202023/Poblaci%C3%B3n%20estimada,%20crecimiento%20intercensal%20y%20estructura%20por%20sexo%20y%20edad.pdf#page=4";

const population2023: [string, number][] = [
  ["UY-MO", 1302954],
  ["UY-CA", 608956],
  ["UY-MA", 212951],
  ["UY-SA", 136197],
  ["UY-CO", 135797],
  ["UY-PA", 121843],
  ["UY-SJ", 119714],
  ["UY-RV", 109300],
  ["UY-TA", 96013],
  ["UY-CL", 91025],
  ["UY-SO", 83685],
  ["UY-RO", 80707],
  ["UY-AR", 77487],
  ["UY-FD", 70325],
  ["UY-DU", 62011],
  ["UY-LA", 59175],
  ["UY-RN", 57334],
  ["UY-TT", 47706],
  ["UY-FS", 26271],
];

export const departmentObservations: Observation[] = population2023.map(
  ([territoryId, value]) => ({
    indicatorId: "poblacion",
    territoryId,
    period: "2023",
    periodLabel: "Censo 2023",
    value,
    status: "OFFICIAL" as const,
    demo: false,
    sourceUrl: CENSUS_SOURCE,
    retrievedAt: "2026-08-25",
    notes:
      "Resultados finales del Censo 2023. Verificado por consistencia: la suma departamental coincide con el total oficial (3.499.451).",
  })
);
