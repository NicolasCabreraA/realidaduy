import type { Observation } from "@/lib/types";

// Valores de titulares nacionales. Investigación verificada el 2026-08-25.
// demo: true ⇒ el valor proviene de prensa que cita al organismo oficial y
// está PENDIENTE DE VALIDACIÓN humana contra el boletín original.

export const nationalObservations: Observation[] = [
  // ── Población ──────────────────────────────────────────────
  {
    indicatorId: "poblacion",
    territoryId: "UY",
    period: "2023",
    periodLabel: "Censo 2023",
    value: 3499451,
    status: "OFFICIAL",
    demo: false,
    sourceUrl:
      "https://www.gub.uy/presidencia/comunicacion/noticias/censo-nacional-2023-contabilizo-3499451-habitantes-uruguay",
    retrievedAt: "2026-08-26",
    notes:
      "Resultados finales del Censo 2023 (publicados en diciembre de 2024). Cifra verificada dígito a dígito contra el PDF oficial del INE (auditoría 2026-08-26).",
  },
  // ── Economía ───────────────────────────────────────────────
  // El PIB trimestral sale del BCU con scripts/ingest/fetch-bcu-pib.mjs.
  {
    indicatorId: "salario-minimo",
    territoryId: "UY",
    period: "2026-01",
    periodLabel: "Desde enero 2026",
    value: 24572,
    status: "OFFICIAL",
    demo: false,
    sourceUrl:
      "https://www.gub.uy/ministerio-trabajo-seguridad-social/comunicacion/noticias/salario-minimo-nacional-24572-desde-1o-enero-2026",
    retrievedAt: "2026-08-25",
    notes: "Decreto 319/025. Valor nominal (a precios corrientes).",
  },
  {
    indicatorId: "salario-minimo",
    territoryId: "UY",
    period: "2026-07",
    periodLabel: "Desde julio 2026",
    value: 25383,
    status: "OFFICIAL",
    demo: false,
    sourceUrl: "https://www.impo.com.uy/bases/decretos/319-2025",
    retrievedAt: "2026-10-12",
    notes:
      "Decreto 319/025, artículo 2: ajuste de +3,3% desde el 1º de julio de 2026. Valor nominal (a precios corrientes).",
  },
  // ── Sociedad ───────────────────────────────────────────────
  {
    indicatorId: "pobreza-personas",
    territoryId: "UY",
    period: "2025",
    periodLabel: "Año 2025",
    value: 16.6,
    status: "OFFICIAL",
    demo: false,
    sourceUrl:
      "https://www.gub.uy/instituto-nacional-estadistica/comunicacion/publicaciones/estimacion-pobreza-metodo-del-ingreso-ano-2025",
    retrievedAt: "2026-10-12",
    notes:
      "Metodología nueva del INE (canasta de la ENGIH 2016-2017, adoptada en 2025): no comparable con la serie de la metodología anterior. Margen de error al 95%: ±0,7 punto. Hogares: 13,2%; indigencia: 1,7% de las personas. Informe técnico del INE publicado el 20/04/2026.",
  },
  {
    indicatorId: "pobreza-personas",
    territoryId: "UY",
    period: "2024",
    periodLabel: "Año 2024",
    value: 17.3,
    status: "OFFICIAL",
    demo: false,
    sourceUrl:
      "https://www5.ine.gub.uy/documents/Demograf%C3%ADayEESS/HTML/ECH/Pobreza/2025/Informe%20pobreza%20Anual-2025.html",
    retrievedAt: "2026-10-12",
    notes:
      "Metodología 2017 del INE. Margen de error al 95%: ±0,9 punto. Hogares: 13,4%; indigencia: 1,5% de las personas. Cuadro 1 del informe anual 2025 del INE.",
  },
  // Estimaciones semestrales: el titular compara cada semestre con el anterior
  // de la misma granularidad, nunca con el año completo.
  {
    indicatorId: "pobreza-personas",
    territoryId: "UY",
    period: "2024-S1",
    periodLabel: "1er semestre 2024",
    value: 18.2,
    status: "OFFICIAL",
    demo: false,
    sourceUrl:
      "https://www5.ine.gub.uy/documents/Demograf%C3%ADayEESS/HTML/ECH/Pobreza/2025/Informe%20pobreza%20primer%20semestre%202025.html",
    retrievedAt: "2026-10-12",
    notes:
      "Metodología 2017 del INE. Hogares: 14,1%; indigencia: 1,8% de las personas. Cuadro 1 del informe del 1er semestre 2025 del INE.",
  },
  {
    indicatorId: "pobreza-personas",
    territoryId: "UY",
    period: "2024-S2",
    periodLabel: "2do semestre 2024",
    value: 16.3,
    status: "OFFICIAL",
    demo: false,
    sourceUrl:
      "https://www5.ine.gub.uy/documents/Demograf%C3%ADayEESS/HTML/ECH/Pobreza/2025/Informe%20pobreza%20primer%20semestre%202025.html",
    retrievedAt: "2026-10-12",
    notes:
      "Metodología 2017 del INE. Hogares: 12,6%; indigencia: 1,2% de las personas. Cuadro 1 del informe del 1er semestre 2025 del INE.",
  },
  {
    indicatorId: "pobreza-personas",
    territoryId: "UY",
    period: "2025-S1",
    periodLabel: "1er semestre 2025",
    value: 17.7,
    status: "OFFICIAL",
    demo: false,
    sourceUrl:
      "https://www.gub.uy/instituto-nacional-estadistica/comunicacion/publicaciones/estimacion-pobreza-metodo-del-ingreso-primer-semestre-2025",
    retrievedAt: "2026-10-12",
    notes:
      "Metodología 2017 del INE. Margen de error al 95%: ±1,0 punto. Hogares: 13,9%; indigencia: 1,8% de las personas. Informe técnico del INE publicado el 01/10/2025.",
  },
  {
    indicatorId: "pobreza-personas",
    territoryId: "UY",
    period: "2026-S1",
    periodLabel: "1er semestre 2026",
    value: 14.8,
    status: "OFFICIAL",
    demo: false,
    sourceUrl:
      "https://www.gub.uy/instituto-nacional-estadistica/comunicacion/publicaciones/estimacion-pobreza-metodo-del-ingreso-primer-semestre-2026",
    retrievedAt: "2026-10-12",
    notes:
      "Metodología 2017 del INE. Margen de error al 95%: ±1,0 punto. Hogares: 11,6%; indigencia: 1,2% de las personas. Es una estimación semestral: se compara con otros semestres, no con el año completo. Informe técnico del INE publicado el 07/10/2026.",
  },
];
