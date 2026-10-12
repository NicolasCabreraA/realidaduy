// Ingesta del Observatorio Territorio Uruguay (OTU, OPP) — indicadores
// departamentales elaborados por OPP sobre fuentes oficiales.
//
// El OTU expone cada indicador como página HTML con tablas por territorio:
//   /?q=listados/listados_datos_formato&id=<datosId>&cant=0&fecha=<fecha>
// con dos layouts: (a) <table data-row='X'> con celdas data-option-value
// ('Hombres'/'Mujeres'/'Total') y data-datocsv (valor crudo); (b) tabla-etiqueta
// con data-row sin celdas seguida de la tabla de valores sin data-row.
//
// Ingiere la pobreza en personas, Metodología 2017 (la NUEVA) — año 2024, por
// depto. Chequeo duro: el total país debe ser ~17,3% (cifra oficial conocida).
//
// La esperanza de vida y el desempleo por departamento salían de acá (2019 y
// 2024); desde el 12/10/2026 salen del INE, con fetch-ine-anuales.mjs: la
// esperanza de vida tiene datos más nuevos (Revisión 2025) y el desempleo, la
// cifra del Anuario, que difiere en una décima en Artigas y Tacuarembó.
// Ojo: el OTU responde 403 a pedidos desde algunas redes en la nube.
//
// Salida: src/data/observations/otu.ts
// Uso: node scripts/ingest/fetch-otu.mjs

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE = path.join(ROOT, "scripts", "ingest", ".cache");
const OUT = path.join(ROOT, "src", "data", "observations", "otu.ts");
const TODAY = new Date().toISOString().slice(0, 10);

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

const DEPT_BY_NAME = {
  artigas: "UY-AR",
  canelones: "UY-CA",
  "cerro largo": "UY-CL",
  colonia: "UY-CO",
  durazno: "UY-DU",
  flores: "UY-FS",
  florida: "UY-FD",
  lavalleja: "UY-LA",
  maldonado: "UY-MA",
  montevideo: "UY-MO",
  paysandu: "UY-PA",
  "rio negro": "UY-RN",
  rivera: "UY-RV",
  rocha: "UY-RO",
  salto: "UY-SA",
  "san jose": "UY-SJ",
  soriano: "UY-SO",
  tacuarembo: "UY-TA",
  "treinta y tres": "UY-TT",
};

const normalize = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

async function cachedFetch(name, url) {
  await mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, name);
  if (await access(file).then(() => true, () => false)) {
    console.log(`  ${name}: usando cache`);
    return readFile(file, "utf8");
  }
  console.log(`  ${name}: descargando...`);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const text = await res.text();
  await writeFile(file, text);
  return text;
}

/** Parsea las tablas OTU en ambos layouts → lista de { row, cells }. */
function parseOtuTables(html) {
  const out = [];
  let pendingRow = null;
  for (const t of html.matchAll(/<table[^>]*>[\s\S]*?<\/table>/g)) {
    const row = (t[0].match(/data-row='([^']+)'/) || [])[1]?.trim() ?? null;
    const cells = {};
    for (const c of t[0].matchAll(
      /data-option-value='([^']+)'[\s\S]*?data-datocsv='([^']+)'/g
    )) {
      cells[c[1].trim()] = Number(String(c[2]).replace(",", "."));
    }
    const hasCells = Object.keys(cells).length > 0;
    if (row !== null && hasCells) {
      out.push({ row, cells });
      pendingRow = null;
    } else if (row !== null && !hasCells) {
      pendingRow = row;
    } else if (hasCells) {
      out.push({ row: pendingRow, cells });
      pendingRow = null;
    }
  }
  return out;
}

function otuUrl(datosId, fecha) {
  return `https://otu.opp.gub.uy/?q=listados/listados_datos_formato&id=${datosId}&cant=0&fecha=${fecha}`;
}

/** Devuelve { iso: celdas } para los 19 departamentos + celdas del total país. */
function splitTerritories(tables, label) {
  const depts = {};
  let pais = null;
  for (const { row, cells } of tables) {
    if (row === null) {
      // La tabla sin etiqueta al final del listado es el total país.
      if (cells.Total !== undefined) pais = cells;
      continue;
    }
    const key = normalize(row);
    if (DEPT_BY_NAME[key] && !(DEPT_BY_NAME[key] in depts)) {
      depts[DEPT_BY_NAME[key]] = cells;
    } else if (key.includes("total") && key.includes("pais") && !pais) {
      pais = cells;
    }
  }
  const n = Object.keys(depts).length;
  if (n !== 19) {
    throw new Error(
      `${label}: se esperaban 19 departamentos, llegaron ${n} (${tables.map((t) => t.row).join(", ")})`
    );
  }
  if (!pais) throw new Error(`${label}: no se encontró la fila de total país`);
  return { depts, pais };
}

const round1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) => round1(n).toFixed(1).replace(".", ",");

// ── 1. Pobreza en personas, Metodología 2017 — año 2024 ─────────────────────
console.log("Pobreza (Met. 2017) por departamento, 2024…");
const POBREZA_URL = otuUrl(3780, "2024-01-01");
const pobrezaHtml = await cachedFetch("otu-pobreza-2024.html", POBREZA_URL);
const pobreza = splitTerritories(parseOtuTables(pobrezaHtml), "pobreza Met.2017");
const paisPobreza = round1(pobreza.pais.Total);
if (Math.abs(paisPobreza - 17.3) > 0.15) {
  throw new Error(
    `CHEQUEO FALLIDO — total país de pobreza 2024 (Met.2017): esperado ~17,3, obtenido ${paisPobreza}`
  );
}
console.log(`  ✓ total país 2024 (Met. 2017): ${paisPobreza}% (cifra oficial conocida: 17,3%)`);

// ── Salida ───────────────────────────────────────────────────────────────────
const lines = [];
for (const [iso, cells] of Object.entries(pobreza.depts).sort()) {
  lines.push(
    `  { indicatorId: "pobreza-personas", territoryId: ${JSON.stringify(iso)}, period: "2024", periodLabel: "2024 · metodología nueva", value: ${round1(cells.Total)}, status: "OFFICIAL", demo: false, breakBefore: true, sourceUrl: ${JSON.stringify(POBREZA_URL)}, retrievedAt: ${JSON.stringify(TODAY)}, notes: "Metodología 2017 (la nueva canasta del INE): comparable con la serie nacional vigente, NO con el dato departamental 2023 (metodología anterior). Hombres: ${fmt(cells.Hombres)}% · Mujeres: ${fmt(cells.Mujeres)}%. Elaboración Observatorio Territorio Uruguay (OPP) sobre la ECH del INE." },`
  );
}

const file = `import type { Observation } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-otu.mjs — no editar a mano.
// Última ejecución: ${TODAY}. Fuente: Observatorio Territorio Uruguay (OPP),
// que elabora indicadores territoriales sobre fuentes oficiales (ECH del INE).
// El script verifica el total país de pobreza 2024 (Met. 2017) contra la cifra
// oficial conocida (17,3%) antes de escribir este archivo.

export const otuObservations: Observation[] = [
${lines.join("\n")}
];
`;

await writeFile(OUT, file);
console.log(`→ ${OUT} (${lines.length} observaciones)`);
