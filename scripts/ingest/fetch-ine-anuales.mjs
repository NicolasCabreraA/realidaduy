// Ingesta de dos series anuales del INE que se publican fuera de los informes
// técnicos mensuales:
//
// 1. Esperanza de vida al nacer: planilla "A.2.3 Indicadores de mortalidad" de
//    las estimaciones y proyecciones de población (Revisión 2025, con base en el
//    Censo 2023), hoja e0. El país tiene un dato por año; cada departamento, un
//    promedio de tres años centrado en el año de referencia, por eso llega un
//    año menos. Del país se guarda la serie completa (gráfico de evolución); de
//    los departamentos, el último año.
// 2. Tasa de desempleo por departamento: cuadro 3.4.4 del Anuario Estadístico
//    Nacional (promedio anual de la ECH). Chequeo duro: el total país tiene que
//    ser la tasa anual oficial.
//
// La planilla está en www5.ine.gub.uy, que manda un intermedio equivocado: se
// usa el correcto de scripts/ingest/certs/ine-intermedios.pem.
//
// Cuando salga un anuario o una revisión nueva, cambian las URL de abajo (y el
// total país esperado del desempleo).
//
// Genera src/data/observations/ine-anuales.ts.
// Uso: node scripts/ingest/fetch-ine-anuales.mjs

import { readFile, writeFile } from "node:fs/promises";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import path from "node:path";
import AdmZip from "adm-zip";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "src", "data", "observations", "ine-anuales.ts");
const CERTS = path.join(ROOT, "scripts", "ingest", "certs", "ine-intermedios.pem");
const TODAY = new Date().toISOString().slice(0, 10);

const MORTALIDAD_XLSX =
  "https://www5.ine.gub.uy/documents/Demograf%C3%ADayEESS/SERIES%20Y%20OTROS/Estimaciones%20y%20proyecciones/Revisi%C3%B3n%202025/A.2.3%20Indicadores%20de%20mortalidad.xlsx";
const MORTALIDAD_PAGINA = "https://www.gub.uy/instituto-nacional-estadistica/indicadoresmortalidad";
const ANUARIO_344 =
  "https://www.gub.uy/instituto-nacional-estadistica/comunicacion/publicaciones/anuario-estadistico-nacional-2025-vol-102/34-empleo-ingresos/344-tasa";
const ANUARIO_ANIO = "2024";
// Tasa de desempleo anual 2024 del INE (promedio de los informes mensuales).
const DESEMPLEO_PAIS_ESPERADO = 8.2;

const UA = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

const intermedios = (await readFile(CERTS, "utf8")).match(
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g
);
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ...intermedios]);

function fail(msg) {
  throw new Error(`Una fuente del INE cambió y el script no puede seguir: ${msg}`);
}

async function get(url) {
  let res;
  try {
    res = await fetch(url, { headers: UA });
  } catch (e) {
    const code = e.cause?.code ?? "";
    if (/CERT|SIGNATURE|ISSUER/.test(code))
      throw new Error(
        `TLS (${code}) en ${url}: el INE cambió de certificado. Revisar scripts/ingest/certs/ine-intermedios.pem`
      );
    throw e;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res;
}

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const DEPTO = {
  artigas: "UY-AR", canelones: "UY-CA", "cerro largo": "UY-CL", colonia: "UY-CO",
  durazno: "UY-DU", flores: "UY-FS", florida: "UY-FD", lavalleja: "UY-LA",
  maldonado: "UY-MA", montevideo: "UY-MO", paysandu: "UY-PA", "rio negro": "UY-RN",
  rivera: "UY-RV", rocha: "UY-RO", salto: "UY-SA", "san jose": "UY-SJ",
  soriano: "UY-SO", tacuarembo: "UY-TA", "treinta y tres": "UY-TT",
};

const fmt = (n, d = 1) => n.toFixed(d).replace(".", ",");
const round1 = (n) => Math.round(n * 10) / 10;
const linea = (o) =>
  `  { indicatorId: ${JSON.stringify(o.indicatorId)}, territoryId: ${JSON.stringify(o.territoryId)}, period: ${JSON.stringify(o.period)}, periodLabel: ${JSON.stringify(o.periodLabel)}, value: ${o.value}, status: "OFFICIAL", demo: false, sourceUrl: ${JSON.stringify(o.sourceUrl)}, retrievedAt: "${TODAY}", notes: ${JSON.stringify(o.notes)} },`;

// ── 1. Esperanza de vida ────────────────────────────────────────────────────
const zip = new AdmZip(Buffer.from(await (await get(MORTALIDAD_XLSX)).arrayBuffer()));
const leer = (nombre) => {
  const entry = zip.getEntry(nombre);
  if (!entry) fail(`falta ${nombre} en la planilla de mortalidad`);
  return entry.getData().toString("utf8");
};
// La hoja e0 se busca por nombre: workbook.xml → id de relación → archivo.
const hoja = leer("xl/workbook.xml").match(/<sheet [^>]*name="e0"[^>]*r:id="([^"]+)"/);
if (!hoja) fail('no está la hoja "e0"');
const destino = leer("xl/_rels/workbook.xml.rels").match(
  new RegExp(`<Relationship [^>]*Id="${hoja[1]}"[^>]*Target="([^"]+)"`)
);
if (!destino) fail("no se encuentra el archivo de la hoja e0");
const strings = [...leer("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  decode(m[1].replace(/<[^>]+>/g, "")).trim()
);
const filas = new Map(); // fila → (columna → valor)
for (const m of leer(`xl/${destino[1].replace(/^\/?xl\//, "")}`).matchAll(
  /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
)) {
  const [, col, fila, attrs, inner] = m;
  const v = inner?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (v === undefined) continue;
  if (!filas.has(Number(fila))) filas.set(Number(fila), new Map());
  filas.get(Number(fila)).set(col, attrs.includes('t="s"') ? strings[Number(v)] : v);
}
const ordenadas = [...filas.entries()].sort((a, b) => a[0] - b[0]).map(([, f]) => f);
const cabecera = ordenadas.find((f) => f.get("A") === "Año");
if (!cabecera) fail('la hoja e0 no tiene la fila "Año"');
const columnas = [...cabecera].filter(([c]) => c !== "A"); // [col, "Uruguay" | departamento]
if (norm(columnas[0][1]) !== "uruguay") fail(`la primera columna es "${columnas[0][1]}", no Uruguay`);
for (const [, nombre] of columnas.slice(1)) if (!DEPTO[norm(nombre)]) fail(`departamento desconocido: "${nombre}"`);
if (columnas.length !== 20) fail(`se esperaban Uruguay y 19 departamentos, hay ${columnas.length} columnas`);

// Bloques "Ambos sexos", "Hombres", "Mujeres", cada uno con una fila por año.
const bloques = {};
let bloque = null;
for (const f of ordenadas) {
  const a = f.get("A");
  if (["Ambos sexos", "Hombres", "Mujeres"].includes(String(a).trim())) {
    bloque = String(a).trim();
    bloques[bloque] = new Map();
  } else if (bloque && /^\d{4}$/.test(String(a))) {
    bloques[bloque].set(String(a), f);
  }
}
for (const b of ["Ambos sexos", "Hombres", "Mujeres"]) if (!bloques[b]) fail(`falta el bloque "${b}"`);
const valor = (b, anio, col) => {
  const v = Number(bloques[b].get(anio)?.get(col));
  return Number.isFinite(v) ? v : null;
};
const enRango = (v, donde) => {
  if (!(v >= 60 && v <= 90)) fail(`esperanza de vida fuera de rango en ${donde}: ${v}`);
  return v;
};

const esperanza = [];
const colPais = columnas[0][0];
const aniosPais = [...bloques["Ambos sexos"].keys()].filter((a) => valor("Ambos sexos", a, colPais) !== null);
for (let i = 1; i < aniosPais.length; i++)
  if (Number(aniosPais[i]) !== Number(aniosPais[i - 1]) + 1) fail(`años del país no consecutivos: ${aniosPais[i - 1]} → ${aniosPais[i]}`);
for (const anio of aniosPais) {
  const t = enRango(valor("Ambos sexos", anio, colPais), `Uruguay ${anio}`);
  esperanza.push({
    indicatorId: "esperanza-vida", territoryId: "UY", period: anio, periodLabel: anio,
    value: round1(t), sourceUrl: MORTALIDAD_PAGINA,
    notes: `Hombres: ${fmt(valor("Hombres", anio, colPais))} años · Mujeres: ${fmt(valor("Mujeres", anio, colPais))} años. INE, estimaciones y proyecciones de población (Revisión 2025, con base en el Censo 2023).`,
  });
}
// Departamentos: el último año que tienen los 19.
const aniosDepto = [...bloques["Ambos sexos"].keys()].filter((a) =>
  columnas.slice(1).every(([c]) => valor("Ambos sexos", a, c) !== null)
);
const ultimoDepto = aniosDepto[aniosDepto.length - 1];
if (!ultimoDepto) fail("ningún año tiene los 19 departamentos");
const [desdeTri, hastaTri] = [Number(ultimoDepto) - 1, Number(ultimoDepto) + 1];
for (const [col, nombre] of columnas.slice(1)) {
  const t = enRango(valor("Ambos sexos", ultimoDepto, col), `${nombre} ${ultimoDepto}`);
  esperanza.push({
    indicatorId: "esperanza-vida", territoryId: DEPTO[norm(nombre)], period: ultimoDepto,
    periodLabel: `${ultimoDepto} (promedio ${desdeTri}–${hastaTri})`,
    value: round1(t), sourceUrl: MORTALIDAD_PAGINA,
    notes: `Promedio de tres años centrado en ${ultimoDepto} (${desdeTri}–${hastaTri}), como publica el INE para los departamentos. Hombres: ${fmt(valor("Hombres", ultimoDepto, col))} años · Mujeres: ${fmt(valor("Mujeres", ultimoDepto, col))} años. INE, estimaciones y proyecciones de población (Revisión 2025).`,
  });
}
console.log(`esperanza de vida: país ${aniosPais[0]}–${aniosPais[aniosPais.length - 1]} (último ${fmt(valor("Ambos sexos", aniosPais[aniosPais.length - 1], colPais), 2)}), departamentos ${ultimoDepto}`);

// ── 2. Desempleo por departamento (Anuario, cuadro 3.4.4) ───────────────────
const html = await (await get(ANUARIO_344)).text();
const tabla = html.slice(html.indexOf("<table"), html.lastIndexOf("</table>"));
if (!/Tasa de desempleo/i.test(decode(tabla))) fail("el cuadro 3.4.4 ya no trae la tasa de desempleo");
const filasAnuario = [];
for (const [, tr] of tabla.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
  const celdas = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter((c) => c !== "");
  // Departamento + actividad (total, h, m) + empleo (t, h, m) + desempleo (t, h, m).
  if (celdas.length === 10 && celdas.slice(1).every((c) => /^\d+,\d$/.test(c)))
    filasAnuario.push({ nombre: celdas[0], n: celdas.slice(1).map((c) => Number(c.replace(",", "."))) });
}
const pais = filasAnuario.find((f) => norm(f.nombre) === "total pais");
if (!pais) fail("el cuadro 3.4.4 no tiene la fila Total País");
if (Math.abs(pais.n[6] - DESEMPLEO_PAIS_ESPERADO) > 0.05)
  fail(`total país de desempleo ${ANUARIO_ANIO}: esperado ${DESEMPLEO_PAIS_ESPERADO}, el cuadro dice ${pais.n[6]}`);
const desempleo = [];
for (const f of filasAnuario) {
  const iso = DEPTO[norm(f.nombre)];
  if (!iso) continue; // Total País, Total Interior
  const [t, h, m] = f.n.slice(6);
  if (!(t > 0 && t < 40)) fail(`desempleo fuera de rango en ${f.nombre}: ${t}`);
  desempleo.push({
    indicatorId: "tasa-desempleo", territoryId: iso, period: ANUARIO_ANIO,
    periodLabel: `${ANUARIO_ANIO} (promedio anual)`, value: t, sourceUrl: ANUARIO_344,
    notes: `Promedio anual ${ANUARIO_ANIO} de la ECH. INE, Anuario Estadístico Nacional 2025, cuadro 3.4.4; el total país (${fmt(pais.n[6])}%) es la tasa anual oficial. Hombres: ${fmt(h)}% · Mujeres: ${fmt(m)}%.`,
  });
}
if (desempleo.length !== 19) fail(`el cuadro 3.4.4 trae ${desempleo.length} departamentos, no 19`);
console.log(`desempleo por departamento ${ANUARIO_ANIO}: 19 departamentos, total país ${fmt(pais.n[6])}%`);

// ── Archivo ─────────────────────────────────────────────────────────────────
const file = `import type { Observation } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-ine-anuales.mjs — no editar a mano.
// Última ejecución: ${TODAY}. Fuentes: INE, indicadores de mortalidad
// (Revisión 2025) y Anuario Estadístico Nacional 2025 (cuadro 3.4.4). El script
// verifica que el total país del desempleo sea la tasa anual oficial.

export const ineAnualesObservations: Observation[] = [
  // Esperanza de vida al nacer: país (serie anual) y departamentos (último año)
${esperanza.map(linea).join("\n")}
  // Tasa de desempleo por departamento (promedio anual)
${desempleo.map(linea).join("\n")}
];
`;
await writeFile(OUT, file);
console.log(`→ ${path.relative(ROOT, OUT)}: ${esperanza.length + desempleo.length} observaciones`);
