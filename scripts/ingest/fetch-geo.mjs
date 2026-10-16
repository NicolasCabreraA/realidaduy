// Ingesta reproducible de geometrías territoriales.
//
//  1. Límites departamentales (19): GeoJSON oficial IDE/Servicio Geográfico Militar
//     publicado en catalogodatos.gub.uy (licencia de Datos Abiertos Uruguay).
//  2. Municipios de Montevideo (8): shapefile oficial de la Intendencia de
//     Montevideo (generador intgis, dataset CKAN "limites-de-municipios-de-montevideo").
//  3. Municipios de todo el país (136): capa "Municipios" de DINOT/MVOT servida por
//     el geoserver del Ministerio de Ambiente (WFS), elaborada desde las Series
//     Electorales 2025 (IDEuy + Corte Electoral, Circular Nº 12208).
//
// Salida: public/geo/departamentos.json, public/geo/municipios-montevideo.json y
// public/geo/municipios.json (GeoJSON simplificado, con properties.territoryId).
//
// Uso: npm run fetch:geo

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as topojsonServer from "topojson-server";
import * as topojsonSimplify from "topojson-simplify";
import * as topojsonClient from "topojson-client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "public", "geo");

// Mismas URLs que src/data/limites.ts (las cita el mapa): si cambia una, cambiar las dos.
// El conjunto ya no figura en el listado del catálogo (su página daba 404 al
// revisarlo el 16/10/2026), pero el archivo sigue publicado.
const DEPARTAMENTOS_URL =
  "https://catalogodatos.gub.uy/dataset/ide-limites-departamentales/resource/3c1b430a-c010-4db1-880d-bdc0f11e4ce9/download/departamentos.geojson";

// El WAF de AGESIC bloquea clientes sin User-Agent de navegador.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

// Mapeo nombre normalizado -> ISO 3166-2:UY (mismo id que src/data/territories.ts).
const DEPARTMENT_IDS = {
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

const MUNICIPIO_LETTERS = ["a", "b", "c", "ch", "d", "e", "f", "g"];

const normalize = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

async function fetchWithRetry(url, opts = {}, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, ...opts });
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
      return res;
    } catch (err) {
      if (i === tries) throw err;
      console.warn(`  Reintento ${i}/${tries - 1} tras error: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

/** Simplifica una FeatureCollection via TopoJSON y redondea coordenadas. */
function simplify(featureCollection, keepFraction, decimals = 4) {
  let topo = topojsonServer.topology({ layer: featureCollection }, 1e5);
  topo = topojsonSimplify.presimplify(topo);
  const minWeight = topojsonSimplify.quantile(topo, keepFraction);
  topo = topojsonSimplify.simplify(topo, minWeight);
  const fc = topojsonClient.feature(topo, topo.objects.layer);
  roundCoords(fc, decimals);
  return fc;
}

function roundCoords(obj, decimals) {
  const f = 10 ** decimals;
  const walk = (coords) => {
    if (typeof coords[0] === "number") {
      coords[0] = Math.round(coords[0] * f) / f;
      coords[1] = Math.round(coords[1] * f) / f;
      return;
    }
    for (const c of coords) walk(c);
  };
  for (const feat of obj.features) walk(feat.geometry.coordinates);
}

function findNameProperty(properties, candidates) {
  const keys = Object.keys(properties);
  for (const candidate of candidates) {
    const key = keys.find((k) => normalize(k) === candidate);
    if (key) return key;
  }
  // Heuristica: primera propiedad string cuyo valor coincida con un departamento.
  for (const k of keys) {
    if (typeof properties[k] === "string" && DEPARTMENT_IDS[normalize(properties[k])]) return k;
  }
  return null;
}

async function fetchDepartamentos() {
  console.log("Descargando limites departamentales (IDE via catalogodatos)...");
  const { access, readFile } = await import("node:fs/promises");
  const cacheDir = path.join(ROOT, "scripts", "ingest", ".cache");
  await mkdir(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, "departamentos-raw.geojson");
  let raw;
  if (await access(cachePath).then(() => true, () => false)) {
    console.log("  Usando descarga en caché.");
    raw = JSON.parse(await readFile(cachePath, "utf8"));
  } else {
    const res = await fetchWithRetry(DEPARTAMENTOS_URL);
    const text = await res.text();
    await writeFile(cachePath, text);
    raw = JSON.parse(text);
  }
  console.log(`  ${raw.features.length} features recibidas`);

  const nameKey = findNameProperty(raw.features[0].properties, [
    "nombre",
    "depto",
    "departamento",
    "nom_dpto",
    "name",
  ]);
  if (!nameKey) {
    throw new Error(
      `No se encontro la propiedad de nombre. Propiedades: ${JSON.stringify(raw.features[0].properties)}`
    );
  }
  console.log(`  Propiedad de nombre detectada: "${nameKey}"`);

  const simplified = simplify(raw, 0.015, 3);
  const unmatched = [];
  for (const feat of simplified.features) {
    const name = feat.properties[nameKey];
    const id = DEPARTMENT_IDS[normalize(name)];
    if (!id) unmatched.push(name);
    feat.properties = { territoryId: id ?? null, name: String(name) };
  }
  if (unmatched.length > 0) {
    throw new Error(`Departamentos sin mapear: ${unmatched.join(", ")}`);
  }
  if (simplified.features.length !== 19) {
    console.warn(`  AVISO: se esperaban 19 features, llegaron ${simplified.features.length}`);
  }

  const out = path.join(OUT_DIR, "departamentos.json");
  const json = JSON.stringify(simplified);
  await writeFile(out, json);
  console.log(`  -> ${out} (${(json.length / 1024).toFixed(0)} KB)`);
}

// ── Municipios de Montevideo ────────────────────────────────────────────────
// Fuente: cartografía censal oficial del INE (Censo 2023, geopackage de
// unidades geoestadísticas, capa ccz_mvd_23_pg en EPSG:4326). Los municipios
// se derivan disolviendo los 18 CCZ según la correspondencia oficial de la
// Intendencia de Montevideo (verificada el 2026-08-25 en
// municipioa.montevideo.gub.uy y es.wikipedia.org/wiki/Anexo:Municipios_de_Montevideo).
//
// NOTA: el shapefile directo de la IM (dataset CKAN "limites-de-municipios-de-
// montevideo", generador intgis generar_zip2.php) entrega un .shp TRUNCADO
// (declara 1.777.156 bytes, entrega 483.328) en todos los formatos — roto del
// lado del servidor al 2026-08-25. Los municipios tampoco existen como límites
// administrativos en OSM. De ahí esta derivación desde cartografía INE.

const GPCK_URL = "https://www5.ine.gub.uy/documents/CENSO%202023/Cartografia/Mayo2026/gpck.zip";
const MONTEVIDEO_CENSUS_TOTAL = 1302954;

const MUNICIPIO_CCZ = {
  A: [14, 17, 18],
  B: [1, 2],
  C: [3, 15, 16],
  CH: [4, 5],
  D: [10, 11],
  E: [6, 7, 8],
  F: [9],
  G: [12, 13],
};

/** Geometría GeoPackage = header "GP" + envelope opcional + WKB estándar. */
function gpkgGeometryToGeoJSON(blob, wkx) {
  const buf = Buffer.from(blob);
  if (buf[0] !== 0x47 || buf[1] !== 0x50) throw new Error("Blob no es geometría GPKG");
  const flags = buf[3];
  const envelopeLen = [0, 32, 48, 48, 64][(flags >> 1) & 0x07] ?? 0;
  return wkx.Geometry.parse(buf.subarray(8 + envelopeLen)).toGeoJSON();
}

async function fetchMunicipios() {
  console.log("Derivando municipios de Montevideo desde cartografía censal INE...");
  const { mkdtemp } = await import("node:fs/promises");
  const os = await import("node:os");
  const { default: AdmZip } = await import("adm-zip");
  const wkx = await import("wkx");
  const { DatabaseSync } = await import("node:sqlite");

  // Caché local del geopackage (58 MB) para no re-descargar en cada corrida.
  const cacheDir = path.join(ROOT, "scripts", "ingest", ".cache");
  await mkdir(cacheDir, { recursive: true });
  const zipPath = path.join(cacheDir, "gpck.zip");
  const { access } = await import("node:fs/promises");
  const cached = await access(zipPath).then(() => true, () => false);
  if (!cached) {
    console.log("  Descargando geopackage censal INE (58 MB)...");
    const res = await fetchWithRetry(GPCK_URL);
    await writeFile(zipPath, Buffer.from(await res.arrayBuffer()));
  } else {
    console.log("  Usando geopackage en caché.");
  }

  const zip = new AdmZip(zipPath);
  const entry = zip.getEntries().find((e) => e.entryName.endsWith("ccz_mvd_23_pg.gpkg"));
  if (!entry) throw new Error("No se encontró ccz_mvd_23_pg.gpkg en el zip del INE");
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "uy-ccz-"));
  const gpkgPath = path.join(tmpDir, "ccz.gpkg");
  await writeFile(gpkgPath, entry.getData());

  const db = new DatabaseSync(gpkgPath, { readOnly: true });
  const rows = db.prepare('SELECT geom, CCZ, POB_TOT_23 FROM "ccz_mvd_23_pg"').all();
  db.close();
  if (rows.length !== 18) throw new Error(`Se esperaban 18 CCZ, llegaron ${rows.length}`);

  const fc = {
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      geometry: gpkgGeometryToGeoJSON(r.geom, wkx),
      properties: { ccz: Number(r.CCZ), poblacion: Number(r.POB_TOT_23) },
    })),
  };

  // Chequeo de consistencia: la suma de CCZ debe aproximar el total censal de
  // Montevideo (difiere levemente: la capa cubre población en viviendas particulares).
  const totalPob = fc.features.reduce((s, f) => s + f.properties.poblacion, 0);
  const diffPct = Math.abs(totalPob - MONTEVIDEO_CENSUS_TOTAL) / MONTEVIDEO_CENSUS_TOTAL;
  console.log(
    `  Población suma CCZ: ${totalPob} (total censal Montevideo: ${MONTEVIDEO_CENSUS_TOTAL}, dif. ${(diffPct * 100).toFixed(2)}%)`
  );
  if (diffPct > 0.01) throw new Error("La suma de población por CCZ difiere >1% del total censal");

  // Disolver CCZ -> municipios compartiendo arcos (bordes internos exactos).
  let topo = topojsonServer.topology({ layer: fc }, 1e5);
  topo = topojsonSimplify.presimplify(topo);
  topo = topojsonSimplify.simplify(topo, topojsonSimplify.quantile(topo, 0.12));
  const geoms = topo.objects.layer.geometries;

  const features = [];
  const populations = [];
  for (const [letter, cczs] of Object.entries(MUNICIPIO_CCZ)) {
    const parts = geoms.filter((g) => cczs.includes(g.properties.ccz));
    if (parts.length !== cczs.length) {
      throw new Error(`Municipio ${letter}: se esperaban CCZ ${cczs.join(",")}, faltan capas`);
    }
    const merged = topojsonClient.merge(topo, parts);
    const poblacion = parts.reduce((s, g) => s + g.properties.poblacion, 0);
    features.push({
      type: "Feature",
      geometry: merged,
      properties: { territoryId: `UY-MO-${letter}`, name: `Municipio ${letter}`, ccz: cczs },
    });
    populations.push({ territoryId: `UY-MO-${letter}`, letter, poblacion, cczs });
  }

  const outFc = { type: "FeatureCollection", features };
  roundCoords(outFc, 4);
  const out = path.join(OUT_DIR, "municipios-montevideo.json");
  const json = JSON.stringify(outFc);
  await writeFile(out, json);
  console.log(`  -> ${out} (${(json.length / 1024).toFixed(0)} KB)`);

  // Población por municipio (CALCULATED: suma de CCZ, cartografía censal INE).
  const TODAY = new Date().toISOString().slice(0, 10);
  const obsLines = populations.map(
    (p) =>
      `  { indicatorId: "poblacion", territoryId: ${JSON.stringify(p.territoryId)}, period: "2023", periodLabel: "Censo 2023", value: ${p.poblacion}, status: "CALCULATED", demo: false, sourceUrl: ${JSON.stringify(GPCK_URL)}, retrievedAt: ${JSON.stringify(TODAY)}, notes: "Suma de los CCZ ${p.cczs.join(", ")} según cartografía censal INE 2023 (población en viviendas particulares; la suma de los 18 CCZ difiere ${(100 * diffPct).toFixed(2)}% del total censal departamental)." },`
  );
  const tsFile = `import type { Observation } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-geo.mjs — no editar a mano.
// Población por municipio de Montevideo, derivada de la cartografía censal
// oficial del INE (Censo 2023, capa ccz_mvd_23_pg) disolviendo los CCZ según la
// correspondencia oficial de la Intendencia (A=14/17/18, B=1/2, C=3/15/16,
// CH=4/5, D=10/11, E=6/7/8, F=9, G=12/13).

export const municipioObservations: Observation[] = [
${obsLines.join("\n")}
];
`;
  const tsOut = path.join(ROOT, "src", "data", "observations", "municipios.ts");
  await writeFile(tsOut, tsFile);
  console.log(`  -> ${tsOut}`);
}

// ── Municipios de todo el país (136) ────────────────────────────────────────
// Fuente: capa "Municipios" (u19600217:c101) de la Dirección Nacional de
// Ordenamiento Territorial (MVOT), publicada en el geoserver del Ministerio de
// Ambiente. Linaje declarado: construida a partir de las Series Electorales
// 2025 (cooperación IDEuy + Corte Electoral, Circular Nº 12208) por el Grupo
// de Trabajo sobre Límites Administrativos. Actualizada al 18/09/2025.
// OJO: los municipios NO cubren todo el territorio nacional (hay zonas rurales
// sin municipio); los huecos del mapa son reales, no datos faltantes.

const MUNICIPIOS_WFS_URL =
  "https://www.ambiente.gub.uy/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=u19600217:c101&outputFormat=application/json&srsName=EPSG:4326";

async function fetchMunicipiosNacionales() {
  console.log("Descargando municipios del país (DINOT/MVOT vía WFS de Ambiente)...");
  const { access, readFile } = await import("node:fs/promises");
  const { municipalTerritories } = await import("../../src/data/territories.ts");

  const cacheDir = path.join(ROOT, "scripts", "ingest", ".cache");
  await mkdir(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, "municipios-dinot-raw.json");
  let raw;
  if (await access(cachePath).then(() => true, () => false)) {
    console.log("  Usando descarga en caché.");
    raw = JSON.parse(await readFile(cachePath, "utf8"));
  } else {
    const res = await fetchWithRetry(MUNICIPIOS_WFS_URL);
    const text = await res.text();
    await writeFile(cachePath, text);
    raw = JSON.parse(text);
  }
  console.log(`  ${raw.features.length} features recibidas`);
  if (raw.features.length !== 136) {
    throw new Error(`Se esperaban 136 municipios, llegaron ${raw.features.length}`);
  }

  // Match (depto, municipio) -> territoryId de src/data/territories.ts.
  // Los nombres difieren solo en prefijos ("VILLA ...", "MUNICIPIO ..."):
  // verificado 136/136 sin alias el 2026-08-27.
  const byKey = new Map(
    municipalTerritories.map((t) => [`${t.id.slice(0, 5)}|${normalize(t.name)}`, t])
  );
  const resolveId = (deptoName, muniName) => {
    const dep = DEPARTMENT_IDS[normalize(deptoName)];
    if (!dep) return null;
    const name = normalize(muniName).replace(/\s+/g, " ");
    for (const candidate of [
      name,
      `villa ${name}`,
      name.replace(/^villa /, ""),
      `municipio ${name}`,
    ]) {
      const hit = byKey.get(`${dep}|${candidate}`);
      if (hit) return hit;
    }
    return null;
  };

  const simplified = simplify(raw, 0.025, 4);
  const matched = new Set();
  const unmatched = [];
  for (const feat of simplified.features) {
    const t = resolveId(feat.properties.depto, feat.properties.municipio);
    if (!t) {
      unmatched.push(`${feat.properties.depto} :: ${feat.properties.municipio}`);
      continue;
    }
    matched.add(t.id);
    feat.properties = { territoryId: t.id, name: t.name };
  }
  if (unmatched.length > 0) {
    throw new Error(`Municipios sin mapear: ${unmatched.join(", ")}`);
  }
  const missing = municipalTerritories.filter((t) => !matched.has(t.id));
  if (missing.length > 0) {
    throw new Error(`Territorios sin geometría: ${missing.map((t) => t.id).join(", ")}`);
  }

  const out = path.join(OUT_DIR, "municipios.json");
  const json = JSON.stringify(simplified);
  await writeFile(out, json);
  console.log(`  -> ${out} (${(json.length / 1024).toFixed(0)} KB)`);
}

await mkdir(OUT_DIR, { recursive: true });
let failures = 0;
try {
  await fetchDepartamentos();
} catch (err) {
  failures++;
  console.error(`ERROR departamentos: ${err.message}`);
}
try {
  await fetchMunicipios();
} catch (err) {
  failures++;
  console.error(`ERROR municipios: ${err.message}`);
}
try {
  await fetchMunicipiosNacionales();
} catch (err) {
  failures++;
  console.error(`ERROR municipios nacionales: ${err.message}`);
}
process.exit(failures > 0 ? 1 : 0);
