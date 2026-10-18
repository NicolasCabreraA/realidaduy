// Modelo de datos central.
// Regla dura: una Observation sin fuente, período o estado no compila.

export type Category =
  | "poblacion"
  | "trabajo"
  | "economia"
  | "sociedad"
  | "politica"
  | "territorio"
  | "cultura"
  | "seguridad";

export type DataStatus =
  | "OFFICIAL"
  | "CALCULATED"
  | "ESTIMATED"
  | "SECONDARY"
  | "UNAVAILABLE";

export type Periodicity =
  | "diaria"
  | "mensual"
  | "trimestral"
  | "semestral"
  | "anual"
  | "quinquenal"
  | "decenal"
  | "por-eleccion"
  | "estatica";

export type GeoLevel = "pais" | "departamento" | "municipio";

/** Controla si la variación se colorea (además de la flecha, nunca solo color). */
export type Reading = "lowerIsBetter" | "higherIsBetter" | "neutral";

export interface Source {
  id: string;
  name: string;
  shortName: string;
  url: string;
  type: "official" | "international" | "academic" | "open-data";
  /** Qué aporta a la plataforma, en lenguaje llano. */
  provides: string;
}

export interface Indicator {
  id: string;
  slug: string;
  name: string;
  /** Nombre corto para selectores de mapa y comparador ("Desempleo"). */
  shortName?: string;
  /** Título-pregunta para gráficos y páginas ("¿Cómo evolucionó el desempleo?"). */
  question: string;
  description: string;
  /** "¿Qué significa?" — 2 o 3 líneas en lenguaje llano. */
  plainDefinition: string;
  category: Category;
  subCategory?: string;
  unit: string;
  /** Cómo se lee la unidad: "por ciento de la población activa". */
  unitLabel: string;
  sourceId: string;
  sourceUrl: string;
  periodicity: Periodicity;
  geographicLevel: GeoLevel[];
  availableFrom?: string;
  methodology: string;
  formula?: string;
  isCalculated: boolean;
  reading: Reading;
  decimals: number;
  lastUpdated: string;
  status: "active" | "planned" | "deprecated";
}

export interface Territory {
  /** ISO 3166-2 para departamentos ("UY-MO"); municipios: "UY-MO-CH". */
  id: string;
  slug: string;
  name: string;
  level: GeoLevel;
  parentId?: string;
  capital?: string;
}

export interface Observation {
  indicatorId: string;
  territoryId: string;
  /** "2026-06", "2026-Q1", "2025", "2024-10-27". */
  period: string;
  periodLabel: string;
  /** null solo si status === "UNAVAILABLE". */
  value: number | null;
  status: DataStatus;
  /**
   * true ⇒ la UI muestra el distintivo "Pendiente de validación".
   * Solo pasa a false tras verificación humana contra la fuente.
   */
  demo: boolean;
  /** URL del dato concreto (boletín, tabla, API). */
  sourceUrl: string;
  retrievedAt: string;
  notes?: string;
  /**
   * true ⇒ quiebre metodológico respecto al período anterior: la UI nunca
   * calcula ni muestra variación contra el dato previo (series no comparables).
   */
  breakBefore?: boolean;
}

// ── Elecciones ──────────────────────────────────────────────────

export interface Party {
  id: string;
  name: string;
  shortName: string;
  /** Solo para mapas/gráficos electorales (codificación de categoría, nunca identidad de la app). */
  color: string;
}

export interface Election {
  id: string;
  date: string;
  name: string;
  type: "nacional" | "balotaje" | "departamental" | "municipal";
  sourceUrl: string;
}

export interface ElectionResult {
  electionId: string;
  territoryId: string;
  partyId: string;
  votes: number | null;
  /** null si el desglose todavía no fue ingerido desde la fuente oficial. */
  pct: number | null;
  /** Base del porcentaje — nunca mezclar bases en un mismo gráfico. */
  pctBase: "validos" | "emitidos";
  winner: boolean;
  /** Nombre de la persona electa, si corresponde (intendente/alcalde/presidente). */
  electedName?: string;
  demo: boolean;
  sourceUrl: string;
}

// ── Educación terciaria ─────────────────────────────────────────

/**
 * Matrícula de una carrera en un departamento, tal como la publica el Anuario
 * Estadístico de Educación del MEC. "Matrícula" cuenta inscripciones activas a
 * carreras: una persona en dos carreras aparece dos veces. Una carrera que se
 * dicta entre dos departamentos ("Paysandú - Rivera") lleva los dos y no entra
 * en el ranking de ninguno.
 */
export interface CareerEnrollment {
  /** "UdelaR", "UTEC", "Formación en Educación (ANEP)". */
  institution: string;
  /** Servicio, instituto tecnológico regional o centro; null si el cuadro no lo dice. */
  unit: string | null;
  career: string;
  territoryIds: string[];
  /** Año lectivo ("2024"). */
  period: string;
  /** null si la fuente no lo informa para esta fila. */
  ingresos: number | null;
  matricula: number;
  egresos: number | null;
  sourceUrl: string;
  retrievedAt: string;
  notes?: string;
}

/**
 * Personas que estudian en la UdelaR según dónde vivían el año antes de
 * ingresar (origen) y en qué departamento cursan (destino). Quien cursa en dos
 * departamentos cuenta en los dos destinos.
 */
export interface StudentFlow {
  /** Departamento de residencia el año antes de ingresar; "EXT" si era otro país. */
  originId: string;
  destinationId: string;
  period: string;
  personas: number;
}

/**
 * Dónde cursan las personas que vivían en un departamento el año antes de
 * ingresar a la UdelaR. Las cuatro categorías son excluyentes y suman personas.
 */
export interface StudentOrigin {
  territoryId: string;
  period: string;
  personas: number;
  /** Cursan solo en su departamento. */
  soloEnDepartamento: number;
  /** Cursan en su departamento y además en otro. */
  enDepartamentoYOtro: number;
  /** Cursan solo en Montevideo (0 para Montevideo, que ya cuenta en soloEnDepartamento). */
  soloMontevideo: number;
  /** Cursan en otros departamentos, sin el propio y no solo en Montevideo. */
  otros: number;
}

/**
 * Vínculo con el trabajo de los estudiantes de una carrera de la UdelaR en un
 * departamento, según lo que declaran en el FormA. Son estudiantes, no
 * egresados: muestra el vínculo temprano con el trabajo, no si "hay trabajo".
 */
export interface CareerWork {
  careerCode: string;
  career: string;
  territoryId: string;
  period: string;
  inscripciones: number;
  /** % que trabaja, sobre quienes respondieron la pregunta. */
  trabajan: number;
  /** % con trabajo muy o bastante relacionado con la carrera, sobre quienes trabajan y respondieron. */
  relacionada: number | null;
}
