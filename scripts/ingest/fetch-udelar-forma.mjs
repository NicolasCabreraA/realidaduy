// Ingesta de los microdatos del FormA-Estudiantes de la UdelaR (Dirección
// General de Planeamiento): de dónde vienen los estudiantes de grado, dónde
// cursan y cuántos ya trabajan en algo relacionado con su carrera.
//
// El FormA es el formulario que completan cada año los estudiantes de grado
// (obligatorio desde 2018, resolución N.° 17 del Consejo Directivo Central). Los
// microdatos son anónimos y de uso libre citando "FormA-Estudiantes 2025,
// Dirección General de Planeamiento - Udelar". Una fila es una inscripción a
// carrera; una persona puede tener varias.
//
// Variables que se usan:
//   SD.3.1           departamento donde vivía en marzo del año anterior a
//                    ingresar a la UdelaR (origen; 20 = otro país)
//   CODDEPARTAMENTO  departamento donde se dicta la carrera (destino)
//   TIPOINSC         carrera, carrera compartida, ciclo inicial o CIO
//   T.15             si trabaja (0 no, 1 sí)
//   T.32             relación del trabajo con la carrera (1 nada … 5 muy)
//
// Salidas:
//   src/data/udelar-forma.ts — flujos origen → destino (personas), resumen por
//     departamento de origen y vínculo con el trabajo por carrera y
//     departamento (solo celdas con al menos MIN_TRABAJO inscripciones).
//   src/data/observations/udelar-forma.ts — tres indicadores por departamento:
//     retención, captación y estudiantes que cursan solo en Montevideo.
//
// Chequeos duros: las etiquetas del diccionario siguen siendo los 19
// departamentos con los mismos códigos, la cantidad de inscripciones y de
// personas es la de esta edición, cada persona tiene un solo origen, y los
// cruces cierran (cada departamento reparte a todas sus personas entre las
// cuatro categorías). Cuando salga otra edición, cambian las constantes.
//
// Uso: node scripts/ingest/fetch-udelar-forma.mjs

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import AdmZip from "adm-zip";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE = path.join(ROOT, "scripts", "ingest", ".cache");
const OUT_DATOS = path.join(ROOT, "src", "data", "udelar-forma.ts");
const OUT_OBS = path.join(ROOT, "src", "data", "observations", "udelar-forma.ts");
const TODAY = new Date().toISOString().slice(0, 10);

const EDICION = "2025";
const PAGINA =
  "https://planeamiento.udelar.edu.uy/portal/acceso-a-microdatos/microdatos-forma-estudiantes-de-grado/";
const ZIP =
  "https://planeamiento.udelar.edu.uy/portal/wp-content/uploads/sites/33/2026/04/FormA-Estudiantes-2025.zip";
const CITA = `FormA-Estudiantes ${EDICION}, Dirección General de Planeamiento - Udelar`;
// Tamaño de la edición 2025: 206.960 inscripciones de 135.416 personas.
const INSCRIPCIONES_ESPERADAS = 206960;
const PERSONAS_ESPERADAS = 135416;
// Por debajo de estos mínimos los porcentajes no se publican.
const MIN_CAPTACION = 100; // personas que cursan en el departamento
const MIN_TRABAJO = 30; // inscripciones a una carrera en un departamento

const UA = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

function fail(msg) {
  throw new Error(`Los microdatos del FormA cambiaron y el script no puede seguir: ${msg}`);
}

async function cachedBuffer(name, url) {
  await mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, name);
  if (await access(file).then(() => true, () => false)) {
    console.log(`  ${name}: usando caché`);
    return readFile(file);
  }
  console.log(`  ${name}: descargando...`);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(file, buf);
  return buf;
}

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const DEPTO = {
  artigas: "UY-AR", canelones: "UY-CA", "cerro largo": "UY-CL", colonia: "UY-CO",
  durazno: "UY-DU", flores: "UY-FS", florida: "UY-FD", lavalleja: "UY-LA",
  maldonado: "UY-MA", montevideo: "UY-MO", paysandu: "UY-PA", "rio negro": "UY-RN",
  rivera: "UY-RV", rocha: "UY-RO", salto: "UY-SA", "san jose": "UY-SJ",
  soriano: "UY-SO", tacuarembo: "UY-TA", "treinta y tres": "UY-TT",
};
const NOMBRE = {
  "UY-AR": "Artigas", "UY-CA": "Canelones", "UY-CL": "Cerro Largo", "UY-CO": "Colonia",
  "UY-DU": "Durazno", "UY-FS": "Flores", "UY-FD": "Florida", "UY-LA": "Lavalleja",
  "UY-MA": "Maldonado", "UY-MO": "Montevideo", "UY-PA": "Paysandú", "UY-RN": "Río Negro",
  "UY-RV": "Rivera", "UY-RO": "Rocha", "UY-SA": "Salto", "UY-SJ": "San José",
  "UY-SO": "Soriano", "UY-TA": "Tacuarembó", "UY-TT": "Treinta y Tres",
};

/** Una línea CSV con comillas dobles ("" escapa una comilla). Sin saltos de línea dentro de campos. */
function campos(linea) {
  const out = [];
  let f = "";
  let q = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (q) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(f);
      f = "";
    } else f += c;
  }
  out.push(f);
  return out;
}
const lineas = (texto) => {
  const ls = texto.split("\n").map((l) => l.replace(/\r$/, ""));
  if (ls[ls.length - 1] === "") ls.pop();
  return ls;
};

// ── Lectura ─────────────────────────────────────────────────────────────────
const zip = new AdmZip(await cachedBuffer(`udelar-forma-${EDICION}.zip`, ZIP));
const csvs = zip.getEntries().filter((e) => /\.csv$/i.test(e.entryName));
const entradaDic = csvs.filter((e) => /diccionario/i.test(e.entryName));
const entradaDatos = csvs.filter((e) => !/diccionario/i.test(e.entryName));
if (entradaDic.length !== 1 || entradaDatos.length !== 1)
  fail(`se esperaban un CSV de datos y un diccionario; hay ${csvs.map((e) => e.entryName).join(", ")}`);
const utf8 = (entry) => {
  const t = entry.getData().toString("utf8");
  if (t.includes("�")) fail(`${entry.entryName} no está en UTF-8`);
  return t;
};

// Diccionario: Variable, Etiqueta_variable, Valor, Etiqueta_valor.
const etiquetas = new Map();
for (const l of lineas(utf8(entradaDic[0])).slice(1)) {
  const [variable, , valor, etiqueta] = campos(l);
  if (!etiquetas.has(variable)) etiquetas.set(variable, new Map());
  etiquetas.get(variable).set(valor, etiqueta);
}
/** Códigos 1..19 → departamento, controlando que las etiquetas sean las de siempre. */
function codigosDepartamento(variable) {
  const e = etiquetas.get(variable);
  if (!e) fail(`el diccionario no tiene ${variable}`);
  const mapa = {};
  for (const [valor, etiqueta] of e) {
    const id = DEPTO[norm(etiqueta)];
    if (id) mapa[valor] = id;
  }
  if (Object.keys(mapa).length !== 19 || new Set(Object.values(mapa)).size !== 19)
    fail(`${variable} ya no trae los 19 departamentos`);
  return mapa;
}
const ORIGEN = codigosDepartamento("SD.3.1");
if (norm(etiquetas.get("SD.3.1").get("20")) !== "otro pais") fail('SD.3.1: el código 20 ya no es "Otro país"');
const DESTINO = codigosDepartamento("CODDEPARTAMENTO");
if (norm(etiquetas.get("T.15")?.get("1")) !== "si" || norm(etiquetas.get("T.15")?.get("0")) !== "no")
  fail("T.15 ya no es 0 = No, 1 = Sí");
const t32 = etiquetas.get("T.32");
if (!/^muy relacionada$/.test(norm(t32?.get("5"))) || !/^bastante relacionada$/.test(norm(t32?.get("4"))))
  fail("T.32: 4 y 5 ya no son bastante y muy relacionada");

// Datos.
const filas = lineas(utf8(entradaDatos[0]));
const cabecera = campos(filas[0]);
const col = (nombre) => {
  const i = cabecera.indexOf(nombre);
  if (i < 0) fail(`falta la columna ${nombre}`);
  return i;
};
const C = {
  id: col("IDUSUARIO"), origen: col("SD.3.1"), destino: col("CODDEPARTAMENTO"), tipo: col("TIPOINSC"),
  codigo: col("COD_CARRERA_CICLO_CIO"), carrera: col("NOM_CARRERA_CICLO_CIO"), trabaja: col("T.15"), relacion: col("T.32"),
};
if (filas.length - 1 !== INSCRIPCIONES_ESPERADAS)
  fail(`hay ${filas.length - 1} inscripciones y la edición ${EDICION} tiene ${INSCRIPCIONES_ESPERADAS}`);

const personas = new Map(); // id → { origen, destinos: Set }
const trabajo = new Map(); // "código|UY-XX" → acumulados
const afuera = new Map(); // "UY-XX (origen)|código" → carrera cursada fuera del departamento
for (let n = 1; n < filas.length; n++) {
  const f = campos(filas[n]);
  if (f.length !== cabecera.length) fail(`la fila ${n} tiene ${f.length} campos y la cabecera ${cabecera.length}`);
  const destino = DESTINO[f[C.destino]];
  if (!destino) fail(`fila ${n}: departamento de la carrera desconocido "${f[C.destino]}"`);
  const origen = ORIGEN[f[C.origen]] ?? (f[C.origen] === "20" ? "EXT" : f[C.origen] === "NA" ? null : undefined);
  if (origen === undefined) fail(`fila ${n}: código de residencia desconocido "${f[C.origen]}"`);
  const id = f[C.id];
  const p = personas.get(id);
  if (!p) personas.set(id, { origen, destinos: new Set([destino]) });
  else {
    if (p.origen !== origen) fail(`la persona ${id} tiene dos residencias de origen`);
    p.destinos.add(destino);
  }
  if (f[C.tipo] !== "CARRERA" && f[C.tipo] !== "CARRERA_COMPARTIDA") continue; // ciclos iniciales y CIO
  // Carreras que cursan fuera de su departamento quienes vivían en él.
  if (origen && origen !== "EXT" && origen !== destino) {
    const ka = `${origen}|${f[C.codigo]}`;
    if (!afuera.has(ka)) afuera.set(ka, { origen, codigo: f[C.codigo], carrera: f[C.carrera], personas: new Set(), mvd: 0, salto: 0, otros: 0 });
    const a = afuera.get(ka);
    a.personas.add(id);
    if (destino === "UY-MO") a.mvd++;
    else if (destino === "UY-SA") a.salto++;
    else a.otros++;
  }
  const k = `${f[C.codigo]}|${destino}`;
  if (!trabajo.has(k)) trabajo.set(k, { codigo: f[C.codigo], carrera: f[C.carrera], destino, n: 0, si: 0, resp: 0, rel: 0, relResp: 0 });
  const t = trabajo.get(k);
  if (t.carrera !== f[C.carrera]) fail(`la carrera ${f[C.codigo]} aparece con dos nombres`);
  t.n++;
  if (f[C.trabaja] === "1" || f[C.trabaja] === "0") {
    t.resp++;
    if (f[C.trabaja] === "1") t.si++;
  }
  if (/^[1-5]$/.test(f[C.relacion])) {
    t.relResp++;
    if (f[C.relacion] === "4" || f[C.relacion] === "5") t.rel++;
  }
}
if (personas.size !== PERSONAS_ESPERADAS) fail(`hay ${personas.size} personas y la edición ${EDICION} tiene ${PERSONAS_ESPERADAS}`);

// ── Cruces ──────────────────────────────────────────────────────────────────
const deptos = Object.keys(NOMBRE);
const flujos = new Map(); // "origen|destino" → personas
const origenes = Object.fromEntries(deptos.map((d) => [d, { personas: 0, solo: 0, yOtro: 0, soloMvd: 0, otros: 0 }]));
const cursan = Object.fromEntries(deptos.map((d) => [d, { personas: 0, conOrigen: 0, deAfuera: 0 }]));
let sinOrigen = 0;
for (const p of personas.values()) {
  for (const d of p.destinos) {
    cursan[d].personas++;
    if (p.origen !== null) {
      cursan[d].conOrigen++;
      if (p.origen !== d) cursan[d].deAfuera++;
    }
  }
  if (p.origen === null) {
    sinOrigen++;
    continue;
  }
  for (const d of p.destinos) flujos.set(`${p.origen}|${d}`, (flujos.get(`${p.origen}|${d}`) ?? 0) + 1);
  if (p.origen === "EXT") continue;
  const o = origenes[p.origen];
  o.personas++;
  if (p.destinos.has(p.origen)) {
    if (p.destinos.size === 1) o.solo++;
    else o.yOtro++;
  } else if (p.destinos.size === 1 && p.destinos.has("UY-MO")) o.soloMvd++;
  else o.otros++;
}
for (const d of deptos) {
  const o = origenes[d];
  if (o.solo + o.yOtro + o.soloMvd + o.otros !== o.personas) fail(`${NOMBRE[d]}: las categorías de origen no suman`);
  // Cada persona de origen d aparece al menos una vez en los flujos con origen d.
  const enFlujos = deptos.reduce((s, x) => s + (flujos.get(`${d}|${x}`) ?? 0), 0);
  if (enFlujos < o.personas) fail(`${NOMBRE[d]}: los flujos tienen menos personas que el origen`);
}
const totalCursan = deptos.reduce((s, d) => s + cursan[d].personas, 0);
const totalFlujos = [...flujos.values()].reduce((s, v) => s + v, 0);
if (totalCursan - totalFlujos !== [...personas.values()].filter((p) => p.origen === null).reduce((s, p) => s + p.destinos.size, 0))
  fail("los flujos no cierran con las personas que cursan en cada departamento");

// ── Salidas ─────────────────────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString("es-UY");
const pct = (a, b) => Math.round((a / b) * 1000) / 10;
const obs = [];
const push = (indicatorId, territoryId, value, notes) =>
  obs.push({ indicatorId, territoryId, value, status: value === null ? "UNAVAILABLE" : "CALCULATED", notes: `${notes} ${CITA}.` });
for (const d of deptos) {
  const o = origenes[d];
  const c = cursan[d];
  const enSuDepto = o.solo + o.yOtro;
  push(
    "udelar-retencion", d, pct(enSuDepto, o.personas),
    enSuDepto === 0
      ? `De ${fmt(o.personas)} personas que vivían en ${NOMBRE[d]} el año antes de ingresar a la UdelaR, ninguna cursa en ${NOMBRE[d]}.`
      : `De ${fmt(o.personas)} personas que vivían en ${NOMBRE[d]} el año antes de ingresar a la UdelaR, ${fmt(enSuDepto)} cursan en ${NOMBRE[d]} (${fmt(o.solo)} solo ahí y ${fmt(o.yOtro)} también en otro departamento).`
  );
  push(
    "udelar-captacion", d, c.conOrigen >= MIN_CAPTACION ? pct(c.deAfuera, c.conOrigen) : null,
    c.conOrigen >= MIN_CAPTACION
      ? `De ${fmt(c.conOrigen)} personas que cursan en la UdelaR en ${NOMBRE[d]}, ${fmt(c.deAfuera)} vivían en otro departamento o en otro país el año antes de ingresar.`
      : c.conOrigen === 0
        ? `Ninguna persona declara cursar en la UdelaR en ${NOMBRE[d]}.`
        : `Menos de ${MIN_CAPTACION} personas cursan en la UdelaR en ${NOMBRE[d]} (${fmt(c.conOrigen)}): no se calcula el porcentaje.`
  );
  push(
    "udelar-solo-montevideo", d, d === "UY-MO" ? null : pct(o.soloMvd, o.personas),
    d === "UY-MO"
      ? "No aplica a Montevideo."
      : `De ${fmt(o.personas)} personas que vivían en ${NOMBRE[d]} el año antes de ingresar a la UdelaR, ${fmt(o.soloMvd)} cursan solo en Montevideo.`
  );
}
const filasTrabajo = [...trabajo.values()]
  .filter((t) => t.n >= MIN_TRABAJO && t.resp > 0)
  .sort((a, b) => a.destino.localeCompare(b.destino) || b.n - a.n);

for (const d of ["UY-PA", "UY-SA", "UY-MA"]) {
  const r = obs.filter((o) => o.territoryId === d).map((o) => `${o.indicatorId} ${o.value}`).join(" · ");
  console.log(`  ${NOMBRE[d]}: ${r}`);
}
console.log(`  ${fmt(personas.size)} personas, ${fmt(sinOrigen)} sin dato de origen; ${flujos.size} flujos; ${filasTrabajo.length} carreras por departamento con ≥ ${MIN_TRABAJO} inscripciones`);

// Carreras cursadas afuera: las de al menos MIN_AFUERA personas, y el resto resumido.
const MIN_AFUERA = 10;
const filasAfuera = [];
const resumenAfuera = [];
for (const d of deptos) {
  const todas = [...afuera.values()].filter((a) => a.origen === d);
  const grandes = todas.filter((a) => a.personas.size >= MIN_AFUERA).sort((a, b) => b.personas.size - a.personas.size);
  const chicas = todas.filter((a) => a.personas.size < MIN_AFUERA);
  const union = (xs) => new Set(xs.flatMap((a) => [...a.personas])).size;
  for (const a of grandes)
    filasAfuera.push({ ...a, personas: a.personas.size, enOrigen: trabajo.get(`${a.codigo}|${d}`)?.n ?? 0 });
  resumenAfuera.push({ d, personas: union(todas), carreras: todas.length, otrasCarreras: chicas.length, otrasPersonas: union(chicas) });
}
const pa = resumenAfuera.find((r) => r.d === "UY-PA");
console.log(`  Paysandú: ${fmt(pa.personas)} personas cursan afuera en ${pa.carreras} carreras; ${filasAfuera.filter((a) => a.origen === "UY-PA").length} con ≥ ${MIN_AFUERA}`);

const lineaFlujo = ([k, v]) => {
  const [o, d] = k.split("|");
  return `  { originId: "${o}", destinationId: "${d}", period: "${EDICION}", personas: ${v} },`;
};
const lineaOrigen = (d) => {
  const o = origenes[d];
  return `  { territoryId: "${d}", period: "${EDICION}", personas: ${o.personas}, soloEnDepartamento: ${o.solo}, enDepartamentoYOtro: ${o.yOtro}, soloMontevideo: ${o.soloMvd}, otros: ${o.otros} },`;
};
const lineaTrabajo = (t) =>
  `  { careerCode: ${JSON.stringify(t.codigo)}, career: ${JSON.stringify(t.carrera)}, territoryId: "${t.destino}", period: "${EDICION}", inscripciones: ${t.n}, trabajan: ${pct(t.si, t.resp)}, relacionada: ${t.relResp >= 10 ? pct(t.rel, t.relResp) : null} },`;
await writeFile(
  OUT_DATOS,
  `import type { CareerAbroad, CareerAbroadSummary, CareerWork, StudentFlow, StudentOrigin } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-udelar-forma.mjs — no editar a mano.
// Última ejecución: ${TODAY}. Fuente: ${CITA} (microdatos anónimos de
// ${fmt(INSCRIPCIONES_ESPERADAS)} inscripciones a carrera de ${fmt(PERSONAS_ESPERADAS)} personas).

export const formaUdelarFuente = {
  cita: ${JSON.stringify(CITA)},
  edicion: "${EDICION}",
  sourceUrl: ${JSON.stringify(PAGINA)},
  retrievedAt: "${TODAY}",
};

/** Personas por departamento de origen y de cursada; "EXT" = vivía en otro país. */
export const flujosUdelar: StudentFlow[] = [
${[...flujos.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(lineaFlujo).join("\n")}
];

export const origenesUdelar: StudentOrigin[] = [
${deptos.map(lineaOrigen).join("\n")}
];

/** Carreras (sin ciclos iniciales ni CIO) con al menos ${MIN_TRABAJO} inscripciones en el departamento. */
export const trabajoCarrerasUdelar: CareerWork[] = [
${filasTrabajo.map(lineaTrabajo).join("\n")}
];

/**
 * Carreras que cursan fuera de su departamento quienes vivían en él el año antes
 * de ingresar (al menos ${MIN_AFUERA} personas). montevideo/salto/otros son inscripciones
 * por departamento donde cursan; enOrigen, inscripciones de esa carrera en el
 * propio departamento, de cualquier procedencia (0 = no se dicta ahí).
 */
export const carrerasAfueraUdelar: CareerAbroad[] = [
${filasAfuera.map((a) => `  { originId: "${a.origen}", careerCode: ${JSON.stringify(a.codigo)}, career: ${JSON.stringify(a.carrera)}, period: "${EDICION}", personas: ${a.personas}, montevideo: ${a.mvd}, salto: ${a.salto}, otros: ${a.otros}, enOrigen: ${a.enOrigen} },`).join("\n")}
];

/** Totales de personas que cursan afuera y de las carreras con menos de ${MIN_AFUERA} personas. */
export const resumenAfueraUdelar: CareerAbroadSummary[] = [
${resumenAfuera.map((r) => `  { originId: "${r.d}", period: "${EDICION}", personas: ${r.personas}, carreras: ${r.carreras}, otrasCarreras: ${r.otrasCarreras}, otrasPersonas: ${r.otrasPersonas} },`).join("\n")}
];
`
);
const lineaObs = (o) =>
  `  { indicatorId: "${o.indicatorId}", territoryId: "${o.territoryId}", period: "${EDICION}", periodLabel: "${EDICION}", value: ${o.value}, status: "${o.status}", demo: false, sourceUrl: ${JSON.stringify(PAGINA)}, retrievedAt: "${TODAY}", notes: ${JSON.stringify(o.notes)} },`;
await writeFile(
  OUT_OBS,
  `import type { Observation } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-udelar-forma.mjs — no editar a mano.
// Última ejecución: ${TODAY}. Cálculos sobre los microdatos del ${CITA}.

export const udelarFormaObservations: Observation[] = [
${obs.map(lineaObs).join("\n")}
];
`
);
console.log(`→ ${path.relative(ROOT, OUT_DATOS)}: ${flujos.size} flujos, 19 orígenes, ${filasTrabajo.length} filas de trabajo`);
console.log(`→ ${path.relative(ROOT, OUT_OBS)}: ${obs.length} observaciones`);
