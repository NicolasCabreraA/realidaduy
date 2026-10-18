// Ingesta del Anuario Estadístico de Educación del MEC: estudiantes por carrera
// y departamento, de todas las instituciones públicas con oferta terciaria.
//
// Lee tres cuadros de la planilla del anuario:
//
// 1. II-7.2.1, universidades públicas (UdelaR y UTEC): ingresos, matrícula y
//    egresos por servicio, departamento y carrera. El cuadro no trae columnas
//    de nivel: la jerarquía se reconstruye por los totales. Cada departamento
//    se cierra cuando sus carreras suman su fila; cada servicio, cuando sus
//    departamentos suman la suya; y así hasta el total país. Si algo no cierra,
//    el script aborta.
// 2. II-7.1.1, totales por departamento e institución: control cruzado. Para
//    UdelaR y UTEC, la suma de las carreras de cada departamento tiene que ser
//    exactamente la fila de este cuadro.
// 3. II-6.2.1, formación en educación (ANEP): ingresos, matrícula y egresos de
//    Magisterio, Profesorado y Educador Social por departamento y centro. Cada
//    fila tiene que sumar sus carreras; cada departamento, sus centros; y el
//    total, Montevideo más el resto del país.
//
// Carreras sin desagregar: la nota (*) del cuadro II-7.2.1 avisa que el total
// de UdelaR incluye casos sin sexo que no figuran en ninguna fila de carrera
// (en 2024: 142 de Licenciatura en Obstetricia en Paysandú y 77 de Tecnólogo
// Cárnico). Se agregan como filas propias, con su departamento tomado de la
// nota o, si la nota no lo dice, del único departamento donde el cuadro
// II-7.1.1 supera a la suma de carreras exactamente en esos casos.
//
// Las universidades privadas (cuadros II-7.2.2 y II-7.2.3) quedan afuera por
// ahora: varias facultades no traen fila de departamento y algunas carreras
// no traen total.
//
// Genera src/data/carreras-mec.ts (filas por carrera) y
// src/data/observations/mec-educacion.ts (matrícula en universidades públicas
// por departamento). Cuando salga un anuario nuevo, cambian las constantes de
// abajo.
// Uso: node scripts/ingest/fetch-mec-educacion.mjs

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import AdmZip from "adm-zip";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE = path.join(ROOT, "scripts", "ingest", ".cache");
const OUT_CARRERAS = path.join(ROOT, "src", "data", "carreras-mec.ts");
const OUT_OBS = path.join(ROOT, "src", "data", "observations", "mec-educacion.ts");
const TODAY = new Date().toISOString().slice(0, 10);

const ANIO = "2024";
const PAGINA =
  "https://www.gub.uy/ministerio-educacion-cultura/datos-y-estadisticas/datos/anuario-estadistico-educacion-2024";
const XLSX =
  "https://www.gub.uy/ministerio-educacion-cultura/sites/ministerio-educacion-cultura/files/2026-02/Anuario%20Estad%C3%ADstico%20de%20Educaci%C3%B3n%202024.xlsx";

const UA = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

function fail(msg) {
  throw new Error(`El anuario del MEC cambió y el script no puede seguir: ${msg}`);
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
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const DEPTO = {
  artigas: "UY-AR", canelones: "UY-CA", "cerro largo": "UY-CL", colonia: "UY-CO",
  durazno: "UY-DU", flores: "UY-FS", florida: "UY-FD", lavalleja: "UY-LA",
  maldonado: "UY-MA", montevideo: "UY-MO", paysandu: "UY-PA", "rio negro": "UY-RN",
  rivera: "UY-RV", rocha: "UY-RO", salto: "UY-SA", "san jose": "UY-SJ",
  soriano: "UY-SO", tacuarembo: "UY-TA", "treinta y tres": "UY-TT",
};
const NOMBRE = Object.fromEntries(
  Object.entries({
    "UY-AR": "Artigas", "UY-CA": "Canelones", "UY-CL": "Cerro Largo", "UY-CO": "Colonia",
    "UY-DU": "Durazno", "UY-FS": "Flores", "UY-FD": "Florida", "UY-LA": "Lavalleja",
    "UY-MA": "Maldonado", "UY-MO": "Montevideo", "UY-PA": "Paysandú", "UY-RN": "Río Negro",
    "UY-RV": "Rivera", "UY-RO": "Rocha", "UY-SA": "Salto", "UY-SJ": "San José",
    "UY-SO": "Soriano", "UY-TA": "Tacuarembó", "UY-TT": "Treinta y Tres",
  })
);

/** "Paysandú" → ["UY-PA"]; "Maldonado - Treinta y tres" → ["UY-MA", "UY-TT"]; otra cosa → null. */
function departamentos(label) {
  const ids = norm(label)
    .split(/\s*-\s*/)
    .map((p) => DEPTO[p]);
  return ids.every(Boolean) ? ids : null;
}

/** Número de una celda: "229.839*" → 229839; vacía → 0. */
function numero(v, donde) {
  if (v === undefined || String(v).trim() === "") return 0;
  const s = String(v).replace(/\*/g, "").trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) fail(`valor no entero en ${donde}: "${v}"`);
  return n;
}

// ── Lectura de la planilla ──────────────────────────────────────────────────
const zip = new AdmZip(await cachedBuffer(`mec-anuario-${ANIO}.xlsx`, XLSX));
const leer = (nombre) => {
  const entry = zip.getEntry(nombre);
  if (!entry) fail(`falta ${nombre} en la planilla`);
  return entry.getData().toString("utf8");
};
const workbook = leer("xl/workbook.xml");
const rels = leer("xl/_rels/workbook.xml.rels");
const strings = [...leer("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""))
);

/** Filas de una hoja buscada por nombre (sin espacios sobrantes): Map fila → { columna: texto }. */
function hoja(nombre) {
  const sheet = [...workbook.matchAll(/<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)].find(
    (m) => decode(m[1]).trim() === nombre
  );
  if (!sheet) fail(`no está la hoja ${nombre}`);
  const rel = [...rels.matchAll(/<Relationship [^>]*>/g)]
    .map((m) => m[0])
    .find((r) => r.includes(`Id="${sheet[2]}"`));
  const target = rel?.match(/Target="([^"]+)"/)?.[1];
  if (!target) fail(`no se encuentra el archivo de la hoja ${nombre}`);
  const xml = leer(`xl/${target.replace(/^\/?xl\//, "")}`);
  const filas = new Map();
  for (const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, col, fila, attrs, inner] = m;
    let v = inner?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    if (v === undefined) {
      const inline = inner?.match(/<is>([\s\S]*?)<\/is>/)?.[1];
      if (inline === undefined) continue;
      v = decode([...inline.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
    } else if (/t="s"/.test(attrs)) v = strings[Number(v)];
    else v = decode(v);
    if (!filas.has(Number(fila))) filas.set(Number(fila), {});
    filas.get(Number(fila))[col] = v;
  }
  return filas;
}

const ordenadas = (filas) => [...filas.keys()].sort((a, b) => a - b);
const iguales = (a, b) => a.every((x, i) => x === b[i]);
const sumar = (a, b) => a.map((x, i) => x + b[i]);
const sePasa = (a, b) => a.some((x, i) => x > b[i]);

// ── 1. Universidades públicas por carrera (II-7.2.1) ────────────────────────
const h721 = hoja("II-7.2.1");
const titulo721 = Object.values(h721.get(5) ?? {}).join(" ");
if (!/UNIVERSIDADES PÚBLICAS/i.test(titulo721) || !titulo721.includes(ANIO))
  fail(`el cuadro II-7.2.1 no es el de universidades públicas ${ANIO}: "${titulo721}"`);
// Columnas: B total ingresos, E total matrícula, H total egresos.
for (const [col, esperado] of [["B", "TOTAL"], ["C", "INGRESO"], ["E", "TOTAL"], ["F", "MATRÍCULA"], ["H", "TOTAL"], ["I", "EGRESO"]])
  if (norm(h721.get(6)?.[col]) !== norm(esperado)) fail(`II-7.2.1: la columna ${col} de la fila 6 no es ${esperado}`);

// Nota (*): casos sin desagregar que no están en ninguna fila de carrera.
const nota721 = ordenadas(h721)
  .map((k) => String(h721.get(k).A ?? ""))
  .find((t) => /^\*\s*En UdelaR/i.test(t.trim()));
const sinDesagregar = [...(nota721 ?? "").matchAll(/-\s*([^:\r\n]+?):\s*(\d+)\s*casos/g)].map((m) => ({
  nombre: m[1].trim(),
  casos: Number(m[2]),
}));
const casosNota = sinDesagregar.reduce((s, x) => s + x.casos, 0);

const inicio721 = ordenadas(h721).find((k) => norm(h721.get(k).A) === "total pais");
if (!inicio721) fail("II-7.2.1 no tiene la fila TOTAL PAÍS");
const datos721 = [];
for (const k of ordenadas(h721)) {
  const r = h721.get(k);
  if (k < inicio721 || !r.A || (r.B === undefined && r.E === undefined)) continue;
  datos721.push({
    fila: k,
    label: String(r.A).trim(),
    v: [numero(r.B, `II-7.2.1 B${k}`), numero(r.E, `II-7.2.1 E${k}`), numero(r.H, `II-7.2.1 H${k}`)],
    asterisco: String(r.E ?? "").includes("*"),
  });
}
const INSTITUCIONES = { udelar: "UdelaR", utec: "UTEC" };
const carreras721 = [];
{
  let i = 0;
  const total = datos721[i++];
  // El asterisco marca los totales que incluyen los casos de la nota.
  const sinNota = (d) => (d.asterisco ? [d.v[0], d.v[1] - casosNota, d.v[2]] : d.v);
  let acc = [0, 0, 0];
  while (!iguales(acc, sinNota(total))) {
    const I = datos721[i++];
    if (!I) fail(`II-7.2.1: las instituciones no llegan al total país (${acc} de ${sinNota(total)})`);
    const institucion = INSTITUCIONES[norm(I.label)];
    if (!institucion) fail(`II-7.2.1: se esperaba una institución en la fila ${I.fila} y dice "${I.label}"`);
    let accI = [0, 0, 0];
    while (!iguales(accI, sinNota(I))) {
      const S = datos721[i++];
      if (!S || departamentos(S.label) || INSTITUCIONES[norm(S.label)])
        fail(`II-7.2.1: ${institucion} no cierra (sus servicios suman ${accI}, el total dice ${sinNota(I)})`);
      let accS = [0, 0, 0];
      while (!iguales(accS, S.v)) {
        const D = datos721[i++];
        const ids = D && departamentos(D.label);
        if (!ids)
          fail(`II-7.2.1: el servicio "${S.label}" (fila ${S.fila}) no cierra: sus departamentos suman ${accS} y el total dice ${S.v}`);
        let accD = [0, 0, 0];
        let n = 0;
        while (n === 0 || !iguales(accD, D.v)) {
          const C = datos721[i];
          if (!C || departamentos(C.label))
            fail(`II-7.2.1: ${D.label} (fila ${D.fila}, ${S.label}) no cierra: sus carreras suman ${accD} y el total dice ${D.v}`);
          i++;
          n++;
          accD = sumar(accD, C.v);
          if (sePasa(accD, D.v)) fail(`II-7.2.1: las carreras de ${D.label} (fila ${D.fila}) superan su total`);
          carreras721.push({ institution: institucion, unit: S.label, career: C.label, territoryIds: ids, v: C.v });
        }
        accS = sumar(accS, D.v);
        if (sePasa(accS, S.v)) fail(`II-7.2.1: los departamentos de "${S.label}" (fila ${S.fila}) superan su total`);
      }
      accI = sumar(accI, S.v);
      if (sePasa(accI, sinNota(I))) fail(`II-7.2.1: los servicios de ${institucion} superan su total`);
    }
    acc = sumar(acc, sinNota(I));
  }
  if (datos721.slice(i).length) fail(`II-7.2.1: quedan filas con datos después del total (fila ${datos721[i].fila})`);
}

// ── 2. Control cruzado con los totales por departamento (II-7.1.1) ──────────
const h711 = hoja("II-7.1.1");
const titulo711 = Object.values(h711.get(5) ?? {}).join(" ");
if (!/DEPARTAMENTO E INSTITUCI/i.test(titulo711) || !titulo711.includes(ANIO))
  fail(`el cuadro II-7.1.1 no es el de totales por departamento e institución ${ANIO}`);
const AGREGADOS = new Set(["total pais", "publico", "privado", "resto del pais", "montevideo y resto del pais"]);
const cuadro711 = new Map(); // "UdelaR|UY-PA" → [ingresos, matrícula, egresos]
{
  let depto = null;
  for (const k of ordenadas(h711)) {
    const r = h711.get(k);
    if (!r.A || (r.B === undefined && r.E === undefined) || /^fuente/i.test(String(r.A).trim())) continue;
    const label = norm(r.A);
    if (AGREGADOS.has(label)) continue;
    const ids = departamentos(r.A);
    if (ids) {
      depto = ids.join("+");
      continue;
    }
    const institucion = INSTITUCIONES[label];
    if (!institucion || !depto) continue;
    cuadro711.set(`${institucion}|${depto}`, [numero(r.B, `II-7.1.1 B${k}`), numero(r.E, `II-7.1.1 E${k}`), numero(r.H, `II-7.1.1 H${k}`)]);
  }
}
const sumaCarreras = new Map();
for (const c of carreras721) {
  const k = `${c.institution}|${c.territoryIds.join("+")}`;
  sumaCarreras.set(k, sumar(sumaCarreras.get(k) ?? [0, 0, 0], c.v));
}
// Casos de la nota: el departamento sale de la propia nota o de la diferencia con II-7.1.1.
const filasNota = [];
for (const caso of sinDesagregar) {
  const enNota = caso.nombre.match(/\(([^)]+)\)\s*$/);
  let ids = enNota ? departamentos(enNota[1]) : null;
  if (!ids) {
    const candidatos = [...cuadro711.entries()].filter(([k, v]) => {
      if (!k.startsWith("UdelaR|")) return false;
      const s = sumaCarreras.get(k) ?? [0, 0, 0];
      return v[1] - s[1] === caso.casos && v[0] === s[0] && v[2] === s[2];
    });
    if (candidatos.length !== 1)
      fail(`no se puede ubicar el departamento de "${caso.nombre}" (${caso.casos} casos sin desagregar)`);
    ids = candidatos[0][0].split("|")[1].split("+");
  }
  filasNota.push({ ...caso, ids, career: caso.nombre.replace(/\s*\([^)]*\)\s*$/, "") });
  const k = `UdelaR|${ids.join("+")}`;
  sumaCarreras.set(k, sumar(sumaCarreras.get(k) ?? [0, 0, 0], [0, caso.casos, 0]));
}
for (const k of new Set([...sumaCarreras.keys(), ...cuadro711.keys()])) {
  const a = sumaCarreras.get(k) ?? [0, 0, 0];
  const b = cuadro711.get(k) ?? [0, 0, 0];
  if (!iguales(a, b)) fail(`${k}: las carreras de II-7.2.1 suman ${a} y II-7.1.1 dice ${b}`);
}

// ── 3. Formación en educación (II-6.2.1) ────────────────────────────────────
const h621 = hoja("II-6.2.1");
const titulo621 = Object.values(h621.get(5) ?? {}).join(" ");
if (!/FORMACI[ÓO]N EN EDUCACI[ÓO]N/i.test(titulo621) || !titulo621.includes(ANIO))
  fail(`el cuadro II-6.2.1 no es el de formación en educación ${ANIO}`);
const filaCarreras = ordenadas(h621).find((k) => Object.values(h621.get(k)).some((v) => norm(v) === "magisterio"));
if (!filaCarreras) fail("II-6.2.1: no está la fila con los nombres de las carreras");
const columna = (c) => c.split("").reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0);
const letra = (n) => (n > 26 ? letra(Math.floor((n - 1) / 26)) : "") + String.fromCharCode(65 + ((n - 1) % 26));
const carreras621 = Object.entries(h621.get(filaCarreras))
  .filter(([, v]) => norm(v) !== "")
  .map(([col, v]) => ({ nombre: String(v).trim(), cols: [0, 1, 2].map((d) => letra(columna(col) + d)) }));
if (carreras621.map((c) => norm(c.nombre)).join("|") !== "magisterio|profesorado|educador social")
  fail(`II-6.2.1: las carreras ya no son Magisterio, Profesorado y Educador Social`);
const filaSubN = ordenadas(h621).find((k) => k > filaCarreras && /^ingr/i.test(String(h621.get(k).C ?? "").trim()));
const filaSub = h621.get(filaSubN) ?? {};
for (const c of [{ cols: ["C", "D", "E"] }, ...carreras621])
  if (c.cols.map((x) => norm(filaSub[x]).slice(0, 4)).join("|") !== "ingr|matr|egr.")
    fail(`II-6.2.1: debajo de cada carrera se esperaba Ingr. / Matr. / Egr. (columnas ${c.cols})`);
const tres = (r, cols, donde) => cols.map((c) => numero(r[c], `${donde} ${c}`));

const centros621 = []; // { depto, centro, por carrera }
{
  const agregados = {};
  const deptos = [];
  let depto = null;
  for (const k of ordenadas(h621)) {
    if (k <= filaSubN) continue;
    const r = h621.get(k);
    if (r.A === undefined) continue;
    if (/^fuente/i.test(String(r.A).trim())) break;
    if (r.C === undefined && r.D === undefined) continue;
    const total = tres(r, ["C", "D", "E"], `II-6.2.1 fila ${k}`);
    const porCarrera = carreras621.map((c) => tres(r, c.cols, `II-6.2.1 fila ${k}`));
    if (!iguales(porCarrera.reduce(sumar, [0, 0, 0]), total)) fail(`II-6.2.1 fila ${k}: las carreras no suman el total`);
    const crudo = String(r.A);
    const partes = crudo.trim().split(/\s{2,}/);
    if (/^\s/.test(crudo)) {
      // Centro con sangría: pertenece al último departamento.
      if (!depto) fail(`II-6.2.1 fila ${k}: centro sin departamento`);
      depto.centros.push({ centro: crudo.trim(), total, porCarrera });
      continue;
    }
    const label = norm(partes[0]);
    if (label === "total" || label === "resto del pais") {
      agregados[label] = total;
      depto = null;
      continue;
    }
    const id = DEPTO[label];
    if (!id) fail(`II-6.2.1 fila ${k}: departamento desconocido "${crudo.trim()}"`);
    depto = { id, total, centros: [] };
    deptos.push(depto);
    // "Paysandú     Paysandú": departamento con un solo centro en la misma fila.
    if (partes[1]) depto.centros.push({ centro: partes.slice(1).join(" "), total, porCarrera });
  }
  if (deptos.length !== 19 || new Set(deptos.map((d) => d.id)).size !== 19)
    fail(`II-6.2.1 trae ${deptos.length} departamentos, no los 19`);
  for (const d of deptos) {
    if (!iguales(d.centros.map((c) => c.total).reduce(sumar, [0, 0, 0]), d.total))
      fail(`II-6.2.1: los centros de ${NOMBRE[d.id]} no suman su total`);
    for (const c of d.centros) centros621.push({ depto: d.id, ...c });
  }
  const interior = deptos.filter((d) => d.id !== "UY-MO").map((d) => d.total).reduce(sumar, [0, 0, 0]);
  if (!agregados["resto del pais"] || !iguales(interior, agregados["resto del pais"]))
    fail("II-6.2.1: los departamentos del interior no suman el resto del país");
  const mvd = deptos.find((d) => d.id === "UY-MO").total;
  if (!agregados.total || !iguales(sumar(mvd, interior), agregados.total))
    fail("II-6.2.1: Montevideo más el resto del país no da el total");
}

// ── Filas de salida ─────────────────────────────────────────────────────────
const CUADRO_721 = `MEC, Anuario Estadístico de Educación ${ANIO}, cuadro II-7.2.1.`;
const CUADRO_621 = `MEC, Anuario Estadístico de Educación ${ANIO}, cuadro II-6.2.1.`;
const filas = [];
for (const c of carreras721) {
  const [ingresos, matricula, egresos] = c.v;
  if (ingresos === 0 && matricula === 0 && egresos === 0) continue;
  const avisos = [CUADRO_721];
  if (c.territoryIds.length > 1) avisos.push("Carrera dictada entre dos departamentos.");
  // La matrícula incluye por definición a la generación de ingreso.
  if (ingresos > matricula)
    avisos.push("En el anuario los ingresos superan a la matrícula, que por definición los incluye: dato a confirmar con el MEC.");
  filas.push({ institution: c.institution, unit: c.unit, career: c.career, territoryIds: c.territoryIds, ingresos, matricula, egresos, notes: avisos.join(" ") });
}
for (const n of filasNota)
  filas.push({
    institution: "UdelaR", unit: null, career: n.career, territoryIds: n.ids, ingresos: null, matricula: n.casos, egresos: null,
    notes: `${CUADRO_721} La carrera no tiene fila propia en el cuadro: sus ${n.casos} estudiantes figuran solo en la nota (*) del total de UdelaR, sin sexo, ingresos ni egresos.`,
  });
for (const c of centros621)
  carreras621.forEach((car, i) => {
    const [ingresos, matricula, egresos] = c.porCarrera[i];
    if (ingresos === 0 && matricula === 0 && egresos === 0) return;
    filas.push({ institution: "Formación en Educación (ANEP)", unit: c.centro, career: car.nombre, territoryIds: [c.depto], ingresos, matricula, egresos, notes: CUADRO_621 });
  });

// Matrícula en universidades públicas por departamento (solo carreras de un departamento).
const porDepto = Object.fromEntries(Object.keys(NOMBRE).map((id) => [id, 0]));
let compartidas = 0;
let totalPublicas = 0;
for (const f of filas) {
  if (f.institution !== "UdelaR" && f.institution !== "UTEC") continue;
  totalPublicas += f.matricula;
  if (f.territoryIds.length === 1) porDepto[f.territoryIds[0]] += f.matricula;
  else compartidas += f.matricula;
}
const totalCuadro = datos721[0].v[1];
if (totalPublicas !== totalCuadro) fail(`la matrícula de las carreras suma ${totalPublicas} y el total país del cuadro es ${totalCuadro}`);
const fmt = (n) => n.toLocaleString("es-UY");
const observaciones = [
  {
    territoryId: "UY", value: totalPublicas,
    notes: `UdelaR y UTEC. Incluye ${fmt(compartidas)} inscripciones en carreras dictadas entre dos departamentos. ${CUADRO_721}`,
  },
  ...Object.entries(porDepto).map(([id, value]) => ({
    territoryId: id, value,
    notes:
      value === 0
        ? `Ninguna carrera de grado de UdelaR ni de UTEC con matrícula en ${NOMBRE[id]}. ${CUADRO_721}`
        : `UdelaR: ${fmt(filas.filter((f) => f.institution === "UdelaR" && f.territoryIds.join() === id).reduce((s, f) => s + f.matricula, 0))} · UTEC: ${fmt(filas.filter((f) => f.institution === "UTEC" && f.territoryIds.join() === id).reduce((s, f) => s + f.matricula, 0))}. No incluye carreras dictadas entre dos departamentos. ${CUADRO_721}`,
  })),
];

console.log(
  `II-7.2.1: ${carreras721.length} filas de carrera (UdelaR y UTEC) + ${filasNota.length} de la nota; II-6.2.1: ${centros621.length} centros. Total país público: ${fmt(totalPublicas)}`
);
for (const id of ["UY-MO", "UY-PA", "UY-SA", "UY-MA"]) console.log(`  ${NOMBRE[id]}: ${fmt(porDepto[id])}`);

// ── Archivos ────────────────────────────────────────────────────────────────
const lineaCarrera = (f) =>
  `  { institution: ${JSON.stringify(f.institution)}, unit: ${JSON.stringify(f.unit)}, career: ${JSON.stringify(f.career)}, territoryIds: ${JSON.stringify(f.territoryIds)}, period: "${ANIO}", ingresos: ${f.ingresos}, matricula: ${f.matricula}, egresos: ${f.egresos}, sourceUrl: ${JSON.stringify(PAGINA)}, retrievedAt: "${TODAY}", notes: ${JSON.stringify(f.notes)} },`;
await writeFile(
  OUT_CARRERAS,
  `import type { CareerEnrollment } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-mec-educacion.mjs — no editar a mano.
// Última ejecución: ${TODAY}. Fuente: MEC, Anuario Estadístico de Educación ${ANIO}
// (cuadros II-7.2.1 y II-6.2.1). El script reconstruye la jerarquía de cada
// cuadro por sus totales y controla las universidades públicas contra los
// totales por departamento del cuadro II-7.1.1: si algo no cierra, no escribe.

export const carrerasMec: CareerEnrollment[] = [
${filas.map(lineaCarrera).join("\n")}
];
`
);
const lineaObs = (o) =>
  `  { indicatorId: "matricula-universidad-publica", territoryId: ${JSON.stringify(o.territoryId)}, period: "${ANIO}", periodLabel: "${ANIO}", value: ${o.value}, status: "CALCULATED", demo: false, sourceUrl: ${JSON.stringify(PAGINA)}, retrievedAt: "${TODAY}", notes: ${JSON.stringify(o.notes)} },`;
await writeFile(
  OUT_OBS,
  `import type { Observation } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-mec-educacion.mjs — no editar a mano.
// Última ejecución: ${TODAY}. Suma de la matrícula por carrera del cuadro
// II-7.2.1 del Anuario Estadístico de Educación ${ANIO} (MEC), controlada
// contra los totales por departamento e institución del cuadro II-7.1.1.

export const mecEducacionObservations: Observation[] = [
${observaciones.map(lineaObs).join("\n")}
];
`
);
console.log(`→ ${path.relative(ROOT, OUT_CARRERAS)}: ${filas.length} filas`);
console.log(`→ ${path.relative(ROOT, OUT_OBS)}: ${observaciones.length} observaciones`);
