// Validación de datos previa a publicación.
// Uso: npm run validate:data
// Importa los módulos de datos TypeScript directamente (Node >=23.6 con
// type-stripping; los módulos de datos solo usan `import type`, que se borra).

const { dictionary } = await import("../src/data/dictionary.ts");
const { allTerritories, departments, montevideoMunicipalities, municipalTerritories } =
  await import("../src/data/territories.ts");
const { nationalObservations } = await import("../src/data/observations/nacional.ts");
const { departmentObservations } = await import("../src/data/observations/departamentos.ts");
const { departmentEchObservations } = await import("../src/data/observations/departamentos-ech.ts");
const { seguridadObservations } = await import("../src/data/observations/seguridad.ts");
const { otuObservations } = await import("../src/data/observations/otu.ts");
const { otuMunicipioObservations } = await import("../src/data/observations/otu-municipios.ts");
const { otuCensalObservations } = await import("../src/data/observations/otu-censal.ts");
const { ineMensualObservations } = await import("../src/data/observations/ine-mensual.ts");
const { municipioObservations } = await import("../src/data/observations/municipios.ts");
const { worldBankSeries } = await import("../src/data/observations/series-banco-mundial.ts");
const { prismaObservations } = await import("../src/data/observations/prisma.ts");
const { bcuPibObservations } = await import("../src/data/observations/bcu-pib.ts");
const { bcuCotizacionesObservations } = await import("../src/data/observations/bcu-cotizaciones.ts");
const { ineAnualesObservations } = await import("../src/data/observations/ine-anuales.ts");
const { sources } = await import("../src/data/sources.ts");
const { parties, elections, electionResults, turnout } = await import("../src/data/elections.ts");
const { catalogDatasets } = await import("../src/data/catalogo.ts");

const observations = [
  ...nationalObservations,
  ...departmentObservations,
  ...departmentEchObservations,
  ...otuObservations,
  ...otuMunicipioObservations,
  ...otuCensalObservations,
  ...ineMensualObservations,
  ...seguridadObservations,
  ...municipioObservations,
  ...worldBankSeries,
  ...prismaObservations,
  ...bcuPibObservations,
  ...bcuCotizacionesObservations,
  ...ineAnualesObservations,
];

const errors = [];
const warnings = [];
const indicatorIds = new Set(dictionary.map((i) => i.id));
const territoryIds = new Set(allTerritories.map((t) => t.id));
const sourceIds = new Set(sources.map((s) => s.id));
const partyIds = new Set(parties.map((p) => p.id));
const electionIds = new Set(elections.map((e) => e.id));

// Población municipal: cobertura razonable (interior + los 8 de Montevideo) y
// suma total menor que la población del país.
{
  const popMunis = [...otuMunicipioObservations, ...municipioObservations].filter(
    (o) => o.indicatorId === "poblacion"
  );
  if (popMunis.length < 115)
    errors.push(`Población municipal: solo ${popMunis.length} municipios con dato`);
  const suma = popMunis.reduce((s, o) => s + (o.value ?? 0), 0);
  if (!(suma > 2000000 && suma < 3499451))
    errors.push(`Suma de población municipal fuera de rango: ${suma}`);
}

const PERIOD_RE = /^\d{4}(-((0[1-9]|1[0-2])(-([0-2]\d|3[01]))?|Q[1-4]|S[12]))?$/;

// 1-4: fuente, período, territorio, integridad referencial de cada observación.
for (const o of observations) {
  const ref = `${o.indicatorId}/${o.territoryId}/${o.period}`;
  if (!indicatorIds.has(o.indicatorId)) errors.push(`Indicador inexistente: ${ref}`);
  if (!territoryIds.has(o.territoryId)) errors.push(`Territorio inexistente: ${ref}`);
  if (!PERIOD_RE.test(o.period)) errors.push(`Período mal formado: ${ref}`);
  if (!/^https?:\/\//.test(o.sourceUrl)) errors.push(`sourceUrl inválida: ${ref}`);
  if (o.value === null && o.status !== "UNAVAILABLE")
    errors.push(`value null sin status UNAVAILABLE: ${ref}`);
  if (o.value !== null && typeof o.value !== "number")
    errors.push(`value no numérico: ${ref}`);
}

// Duplicados: una misma observación (indicador + territorio + período) no puede
// venir de dos archivos. Riesgo real desde que hay ingesta automática conviviendo
// con carga manual.
{
  const vistas = new Map();
  for (const o of observations) {
    // Un dato oficial y una estimación secundaria del mismo período conviven a
    // propósito (Censo 2023 vs Banco Mundial): getLatest prioriza el oficial.
    const tier = o.status === "SECONDARY" ? "secundaria" : "primaria";
    const k = `${o.indicatorId}|${o.territoryId}|${o.period}`;
    if (vistas.has(`${k}|${tier}`)) errors.push(`Observación duplicada (${tier}): ${k}`);
    else vistas.set(`${k}|${tier}`, o);
  }
}

// Catálogo Nacional: la Licencia de Datos Abiertos pide citar cada conjunto con
// su nombre y enlace, y el sitio lo hace desde src/data/catalogo.ts. Una URL del
// catálogo que no esté registrada ahí se publicaría sin esa cita.
{
  const conocidos = new Set(catalogDatasets.flatMap((d) => [d.id, d.name]));
  const conUrl = [
    ...observations.map((o) => [`observación ${o.indicatorId}/${o.territoryId}/${o.period}`, o.sourceUrl]),
    ...dictionary.map((i) => [`indicador ${i.id}`, i.sourceUrl]),
    ...elections.map((e) => [`elección ${e.id}`, e.sourceUrl]),
    ...electionResults.map((r) => [`resultado ${r.electionId}/${r.territoryId}/${r.partyId}`, r.sourceUrl]),
    ...turnout.map((t) => [`participación ${t.electionId}`, t.sourceUrl]),
  ];
  const sinRegistrar = new Map();
  for (const [ref, sourceUrl] of conUrl) {
    if (!sourceUrl) continue;
    let url;
    try {
      url = new URL(sourceUrl);
    } catch {
      continue;
    }
    if (url.hostname !== "catalogodatos.gub.uy") continue;
    const conjunto = /^\/dataset\/([^/]+)/.exec(url.pathname)?.[1];
    if (!conjunto || !conocidos.has(conjunto)) sinRegistrar.set(conjunto ?? sourceUrl, ref);
  }
  for (const [conjunto, ref] of sinRegistrar)
    errors.push(`Conjunto del Catálogo Nacional sin registrar en src/data/catalogo.ts: ${conjunto} (${ref})`);
}

// Los datos y el diccionario no citan Wikipedia: cada uno enlaza al organismo.
for (const [ref, sourceUrl] of [
  ...observations.map((o) => [`${o.indicatorId}/${o.territoryId}/${o.period}`, o.sourceUrl]),
  ...dictionary.map((i) => [`indicador ${i.id}`, i.sourceUrl]),
]) {
  if (/wikipedia\.org/i.test(sourceUrl ?? "")) errors.push(`Fuente Wikipedia en ${ref}`);
}

// Diccionario: fuentes válidas.
for (const i of dictionary) {
  if (!sourceIds.has(i.sourceId)) errors.push(`Indicador ${i.id}: fuente ${i.sourceId} inexistente`);
}

// 5: consistencia territorial.
if (departments.length !== 19) errors.push(`Se esperaban 19 departamentos, hay ${departments.length}`);
if (montevideoMunicipalities.length !== 8)
  errors.push(`Se esperaban 8 municipios de Montevideo, hay ${montevideoMunicipalities.length}`);
if (municipalTerritories.length !== 136)
  errors.push(`Se esperaban 136 municipios en el país, hay ${municipalTerritories.length}`);
// Todo municipio debe tener exactamente un lema ganador en 2025.
for (const m of municipalTerritories) {
  const winners = electionResults.filter(
    (r) => r.electionId === "municipal-2025" && r.territoryId === m.id && r.winner
  ).length;
  if (winners !== 1) errors.push(`${m.name} (${m.id}): ${winners} ganadores municipales`);
}

// 6: la suma de población departamental debe igualar el total censal del país.
const totalUY = nationalObservations.find(
  (o) => o.indicatorId === "poblacion" && o.territoryId === "UY" && o.period === "2023"
)?.value;
const sumaDeptos = departmentObservations
  .filter((o) => o.indicatorId === "poblacion")
  .reduce((s, o) => s + (o.value ?? 0), 0);
if (totalUY !== sumaDeptos)
  errors.push(`Suma departamental (${sumaDeptos}) ≠ total censal (${totalUY})`);

// Municipios: suma dentro del margen documentado respecto al total de Montevideo.
const montevideo = departmentObservations.find(
  (o) => o.indicatorId === "poblacion" && o.territoryId === "UY-MO"
)?.value;
const sumaMunicipios = municipioObservations.reduce((s, o) => s + (o.value ?? 0), 0);
if (montevideo && Math.abs(sumaMunicipios - montevideo) / montevideo > 0.01)
  errors.push(`Suma municipal (${sumaMunicipios}) difiere >1% de Montevideo (${montevideo})`);

// Series departamentales: cada bloque debe cubrir los 19 departamentos.
const deptWide = [
  ...departmentEchObservations,
  ...otuObservations,
  ...ineAnualesObservations,
  ...otuCensalObservations,
  ...ineMensualObservations,
  ...seguridadObservations,
];
for (const [indicatorId, period] of [
  ["nbi-vivienda", "2011"],
  ["nbi-confort", "2011"],
  ["analfabetismo", "2011"],
  ["asistencia-media", "2011"],
  ["educacion-terciaria", "2011"],
  ["tasa-desempleo", "2024"],
  ["informalidad", "2025"],
  ["ingreso-medio-hogar", "2023"],
  ["pobreza-personas", "2023"],
  ["pobreza-personas", "2024"],
  ["esperanza-vida", "2022"],
  ["homicidios-100k", "2025"],
  ["rapinas-100k", "2025"],
  ["hurtos-100k", "2025"],
]) {
  const n = deptWide.filter(
    (o) =>
      o.indicatorId === indicatorId &&
      o.period === period &&
      o.territoryId.split("-").length === 2
  ).length;
  if (n !== 19) errors.push(`${indicatorId} ${period}: ${n}/19 departamentos`);
}

// Elecciones: referencias válidas y exactamente un ganador por territorio/elección.
const winnerKey = new Map();
for (const r of electionResults) {
  const ref = `${r.electionId}/${r.territoryId}/${r.partyId}`;
  if (!electionIds.has(r.electionId)) errors.push(`Elección inexistente: ${ref}`);
  if (!territoryIds.has(r.territoryId)) errors.push(`Territorio inexistente en elección: ${ref}`);
  if (!partyIds.has(r.partyId)) errors.push(`Partido inexistente: ${ref}`);
  if (r.winner) {
    const k = `${r.electionId}|${r.territoryId}`;
    winnerKey.set(k, (winnerKey.get(k) ?? 0) + 1);
  }
}
for (const [k, n] of winnerKey) {
  if (n !== 1) errors.push(`${n} ganadores en ${k}`);
}
for (const d of departments) {
  if (!winnerKey.has(`departamental-2025|${d.id}`))
    errors.push(`Falta ganador departamental 2025 en ${d.name}`);
}
for (const m of montevideoMunicipalities) {
  if (!winnerKey.has(`municipal-2025|${m.id}`))
    errors.push(`Falta ganador municipal 2025 en ${m.name}`);
}

// 7: outliers en series (aviso, no error): |z| > 3 dentro de cada serie anual.
const seriesByIndicator = new Map();
for (const o of worldBankSeries) {
  if (!seriesByIndicator.has(o.indicatorId)) seriesByIndicator.set(o.indicatorId, []);
  seriesByIndicator.get(o.indicatorId).push(o);
}
for (const [id, serie] of seriesByIndicator) {
  const values = serie.map((o) => o.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  if (sd === 0) continue;
  for (const o of serie) {
    const z = Math.abs((o.value - mean) / sd);
    if (z > 3) warnings.push(`Outlier |z|=${z.toFixed(1)} en ${id} ${o.period} (${o.value})`);
  }
}

// 8: PIB anual oficial. Es un empalme: PRISMA hasta 2016 y BCU desde 2017, sin
// huecos ni años repetidos (si no, el gráfico de evolución vuelve al Banco
// Mundial). Contra el Banco Mundial es un aviso, no un error: miden lo mismo,
// desde 2017 coinciden en ±0,2 puntos y antes difieren hasta un punto. Una
// diferencia mayor indica que una serie cambió de unidad o de definición.
{
  const prismaAnual = prismaObservations.map((o) => Number(o.period));
  const bcuAnual = bcuPibObservations.filter((o) => o.period.length === 4).map((o) => Number(o.period));
  if (Math.max(...prismaAnual) + 1 !== Math.min(...bcuAnual))
    errors.push(
      `PIB anual: el empalme no es continuo (PRISMA hasta ${Math.max(...prismaAnual)}, BCU desde ${Math.min(...bcuAnual)})`
    );
  const bm = new Map(
    worldBankSeries.filter((o) => o.indicatorId === "pib-variacion").map((o) => [o.period, o.value])
  );
  for (const o of [...prismaObservations, ...bcuPibObservations]) {
    const w = bm.get(o.period);
    if (w !== undefined && Math.abs(o.value - w) > 1.5)
      warnings.push(`PIB ${o.period}: oficial ${o.value}% vs Banco Mundial ${w}%`);
  }
}

// Resumen.
console.log(`Observaciones: ${observations.length}`);
console.log(`Indicadores: ${dictionary.length} (${dictionary.filter((i) => i.status === "active").length} activos)`);
console.log(`Resultados electorales: ${electionResults.length}`);
for (const w of warnings) console.warn(`AVISO: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error(`\n${errors.length} errores de validación.`);
  process.exit(1);
}
console.log(`\nValidación OK (${warnings.length} avisos).`);
