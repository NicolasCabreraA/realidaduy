// Ingesta de la cotización del dólar: dólar estadounidense billete en el
// mercado interbancario (código 2225 del BCU), valor vendedor. Sale del
// servicio web público de cotizaciones del BCU, que solo acepta rangos de hasta
// un año: se pide año por año desde 2000.
//
// Genera src/data/observations/bcu-cotizaciones.ts con:
// - el último día disponible y el cierre del mes anterior (titular y variación);
// - el promedio de cada mes completo desde 2024;
// - el promedio de cada año completo desde 2000 (gráfico de evolución).
// Los promedios los calcula este script con todas las cotizaciones diarias.
//
// Antes de escribir compara el último dato contra la página de cotizaciones del
// BCU, que muestra el mismo valor. Esa página está en www.bcu.gub.uy, que no
// manda la cadena completa de certificados: se usan los intermedios de
// scripts/ingest/certs/bcu-intermedios.pem, como en fetch-bcu-pib.mjs.
//
// Uso: node scripts/ingest/fetch-bcu-cotizaciones.mjs

import { readFile, writeFile } from "node:fs/promises";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "src", "data", "observations", "bcu-cotizaciones.ts");
const CERTS = path.join(ROOT, "scripts", "ingest", "certs", "bcu-intermedios.pem");
const TODAY = new Date().toISOString().slice(0, 10);

const WS = "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones";
const PAGINA = "https://www.bcu.gub.uy/Estadisticas-e-Indicadores/Paginas/Cotizaciones.aspx";
const DOLAR = 2225; // DLS. USA BILLETE
const DESDE_ANIO = 2000;
const DESDE_MES = "2024-01"; // como las series mensuales del INE
// Rango plausible en pesos por dólar: fuera de esto es otra moneda u otra unidad.
const MIN = 5;
const MAX = 150;
// Compra y venta del mismo día difieren menos de 1%. Si difieren más de 5%, uno
// de los dos está mal tipeado en la fuente (el 27/04/2000 el BCU publica compra
// 11,9 y venta 1,905): en años cerrados ese día no entra en el promedio y queda
// anotado; en el año en curso el script se frena.
const DIF_COMPRA_VENTA = 0.05;
const excluidos = [];

const intermedios = (await readFile(CERTS, "utf8")).match(
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g
);
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ...intermedios]);

function fail(msg) {
  throw new Error(`El servicio de cotizaciones del BCU cambió y el script no puede seguir: ${msg}`);
}

async function post(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body,
    });
  } catch (e) {
    const code = e.cause?.code ?? "";
    if (/CERT|SIGNATURE|ISSUER/.test(code))
      throw new Error(
        `TLS (${code}) en ${url}: el BCU cambió de certificado. Actualizar scripts/ingest/certs/bcu-intermedios.pem`
      );
    throw e;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

/** Cotizaciones del dólar entre dos fechas (como máximo un año). */
async function cotizaciones(desde, hasta) {
  const xml = await post(
    WS,
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">` +
      `<soapenv:Body><cot:wsbcucotizaciones.Execute><cot:Entrada>` +
      `<cot:Moneda><cot:item>${DOLAR}</cot:item></cot:Moneda>` +
      `<cot:FechaDesde>${desde}</cot:FechaDesde><cot:FechaHasta>${hasta}</cot:FechaHasta>` +
      `<cot:Grupo>0</cot:Grupo>` +
      `</cot:Entrada></cot:wsbcucotizaciones.Execute></soapenv:Body></soapenv:Envelope>`
  );
  const status = xml.match(/<status>([^<]*)<\/status>/)?.[1];
  const mensaje = xml.match(/<mensaje>([^<]*)<\/mensaje>/)?.[1] ?? "";
  if (status !== "1") return { error: mensaje || `status ${status}`, filas: [] };
  const filas = [];
  for (const [, item] of xml.matchAll(/<datoscotizaciones\.dato[^>]*>([\s\S]*?)<\/datoscotizaciones\.dato>/g)) {
    const campo = (k) => item.match(new RegExp(`<${k}>([^<]*)</${k}>`))?.[1];
    const fecha = campo("Fecha");
    const moneda = Number(campo("Moneda"));
    const nombre = campo("Nombre") ?? "";
    const venta = Number(campo("TCV"));
    const compra = Number(campo("TCC"));
    if (moneda !== DOLAR || !/DLS\. USA BILLETE/.test(nombre))
      fail(`se pidió el dólar billete (${DOLAR}) y vino ${moneda} "${nombre}"`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "")) fail(`fecha mal formada: "${fecha}"`);
    if (Math.abs(venta / compra - 1) > DIF_COMPRA_VENTA) {
      if (fecha.slice(0, 4) >= TODAY.slice(0, 4))
        fail(`el ${fecha} la venta (${venta}) y la compra (${compra}) no son coherentes`);
      excluidos.push({ fecha, venta, compra });
      continue;
    }
    if (!(venta >= MIN && venta <= MAX)) fail(`cotización fuera de rango el ${fecha}: ${venta}`);
    filas.push({ fecha, venta });
  }
  return { error: null, filas };
}

// ── Descarga, año por año ───────────────────────────────────────────────────
const anioActual = Number(TODAY.slice(0, 4));
const dias = [];
for (let anio = DESDE_ANIO; anio <= anioActual; anio++) {
  const hasta = anio === anioActual ? TODAY : `${anio}-12-31`;
  const { error, filas } = await cotizaciones(`${anio}-01-01`, hasta);
  // El 1º de enero todavía no hay cotizaciones del año: solo es un error si
  // falta un año completo.
  if (error && anio < anioActual) fail(`${anio}: ${error}`);
  if (anio < anioActual && filas.length < 200) fail(`${anio} trae solo ${filas.length} días hábiles`);
  dias.push(...filas);
}
for (let i = 1; i < dias.length; i++) {
  if (dias[i].fecha <= dias[i - 1].fecha) fail(`fechas fuera de orden: ${dias[i - 1].fecha} → ${dias[i].fecha}`);
}

// ── Promedios ───────────────────────────────────────────────────────────────
const promedio = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000;
const agrupar = (largo) => {
  const g = new Map();
  for (const d of dias) {
    const k = d.fecha.slice(0, largo);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(d.venta);
  }
  return g;
};

const ultimo = dias[dias.length - 1];
const mesUltimo = ultimo.fecha.slice(0, 7);
// Cierre del mes anterior al del último dato: contra él se mide la variación.
const cierre = [...dias].reverse().find((d) => d.fecha.slice(0, 7) < mesUltimo);
if (!cierre) fail("no hay cotizaciones del mes anterior");

const anuales = [...agrupar(4)]
  .filter(([anio]) => Number(anio) < anioActual)
  .map(([anio, xs]) => ({ periodo: anio, valor: promedio(xs) }));
// Meses completos: todos menos el del último dato.
const mensuales = [...agrupar(7)]
  .filter(([mes]) => mes >= DESDE_MES && mes < mesUltimo)
  .map(([mes, xs]) => {
    if (xs.length < 15) fail(`${mes} trae solo ${xs.length} días hábiles`);
    return { periodo: mes, valor: promedio(xs) };
  });

// Un salto de más de 15% contra el promedio del mes anterior es casi seguro un
// error de datos (otra moneda, otra escala), no un movimiento del mercado.
const refMes = mensuales[mensuales.length - 1];
if (Math.abs(ultimo.venta / refMes.valor - 1) > 0.15)
  fail(`el último dato (${ultimo.venta}) se aleja más de 15% del promedio de ${refMes.periodo} (${refMes.valor})`);

// ── Verificación contra la página del BCU ───────────────────────────────────
// La tabla muestra "DLS. USA BILLETE 09/10/2026 40,184 40,184 1" (venta,
// compra, arbitraje). Si el día que muestra la página coincide con el último
// del servicio, el valor tiene que ser el mismo.
try {
  const html = await (
    await fetch(PAGINA, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)" },
    })
  ).text();
  const texto = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const m = texto.match(/DLS\. USA BILLETE (\d{2})\/(\d{2})\/(\d{4}) (\d+,\d+)/);
  if (!m) console.warn("AVISO: no se encontró el dólar billete en la página de cotizaciones del BCU");
  else {
    const fecha = `${m[3]}-${m[2]}-${m[1]}`;
    const venta = Number(m[4].replace(",", "."));
    const delServicio = dias.find((d) => d.fecha === fecha);
    if (!delServicio) console.warn(`AVISO: la página del BCU muestra el ${fecha}, que el servicio todavía no trae`);
    else if (Math.abs(delServicio.venta - venta) > 0.0005)
      fail(`la página del BCU dice ${venta} para el ${fecha} y el servicio, ${delServicio.venta}`);
    else console.log(`Página del BCU verificada: ${fecha} ${venta}`);
  }
} catch (e) {
  if (e.message.startsWith("El servicio de cotizaciones")) throw e;
  console.warn(`AVISO: no se pudo leer la página de cotizaciones del BCU (${e.message})`);
}

// ── Archivo ─────────────────────────────────────────────────────────────────
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"];
const fechaLarga = (f) => `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1].toLowerCase()} de ${f.slice(0, 4)}`;
const fechaCorta = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
const mesLargo = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

const linea = (period, periodLabel, value, status, notes) =>
  `  { indicatorId: "dolar", territoryId: "UY", period: ${JSON.stringify(period)}, periodLabel: ${JSON.stringify(periodLabel)}, value: ${value}, status: "${status}", demo: false, sourceUrl: ${JSON.stringify(PAGINA)}, retrievedAt: "${TODAY}", notes: ${JSON.stringify(notes)} },`;

const notaDia = (f) => `Cotización del BCU para el ${fechaCorta(f)}: dólar billete interbancario, valor vendedor.`;
const fmt = (n) => String(n).replace(".", ",");
// Una sola nota para toda la serie anual (la página la muestra debajo del
// gráfico, sin repetirla por año).
const notaAnual =
  "Promedio de las cotizaciones diarias de cada año (dólar billete interbancario del BCU, valor vendedor). Cálculo de realidad.uy." +
  excluidos
    .map((e) => ` Se excluye el ${fechaCorta(e.fecha)}: el BCU publica compra ${fmt(e.compra)} y venta ${fmt(e.venta)}, un error de tipeo.`)
    .join("");
const notaMensual =
  "Promedio de las cotizaciones diarias del mes (dólar billete interbancario del BCU, valor vendedor). Cálculo de realidad.uy.";
const lines = [
  "  // Promedio anual (gráfico de evolución)",
  ...anuales.map((a) =>
    linea(a.periodo, `${a.periodo} (promedio anual)`, a.valor, "CALCULATED", notaAnual)
  ),
  "  // Promedio mensual",
  ...mensuales.map((m) =>
    linea(m.periodo, `${mesLargo(m.periodo)} (promedio)`, m.valor, "CALCULATED", notaMensual)
  ),
  "  // Diario: cierre del mes anterior y último dato (titular y variación)",
  linea(cierre.fecha, fechaLarga(cierre.fecha), cierre.venta, "OFFICIAL", `${notaDia(cierre.fecha)} Último día hábil de ${mesLargo(cierre.fecha.slice(0, 7)).toLowerCase()}.`),
  linea(ultimo.fecha, fechaLarga(ultimo.fecha), ultimo.venta, "OFFICIAL", notaDia(ultimo.fecha)),
];

const file = `import type { Observation } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-bcu-cotizaciones.mjs — no editar a mano.
// Última ejecución: ${TODAY}. Fuente: BCU, servicio web de cotizaciones (dólar
// billete interbancario, código ${DOLAR}, valor vendedor). El último dato se
// verificó contra la página de cotizaciones del BCU.

export const bcuCotizacionesObservations: Observation[] = [
${lines.join("\n")}
];
`;

await writeFile(OUT, file);
for (const e of excluidos) console.warn(`AVISO: se excluye el ${e.fecha} (compra ${e.compra}, venta ${e.venta})`);
console.log(
  `dólar → dolar: ${anuales.length} años (${anuales[0].periodo}–${anuales[anuales.length - 1].periodo}), ${mensuales.length} meses (${mensuales[0].periodo}–${refMes.periodo}), último ${ultimo.fecha} ${ultimo.venta} (cierre ${cierre.fecha} ${cierre.venta})`
);
