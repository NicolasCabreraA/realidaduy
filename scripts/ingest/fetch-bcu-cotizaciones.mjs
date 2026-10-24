// Ingesta de cotizaciones del BCU: dólar estadounidense, real brasileño, euro y
// peso argentino, valor vendedor del mercado interbancario. Sale del servicio
// web público de cotizaciones del BCU, que solo acepta rangos de hasta un año:
// se pide año por año desde 2000, moneda por moneda.
//
// Genera src/data/observations/bcu-cotizaciones.ts con, para cada moneda:
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
const DESDE_ANIO = 2000;
const DESDE_MES = "2024-01"; // como las series mensuales del INE

// Una entrada por moneda. `nombre`: cómo la llama el servicio (si viene otra,
// el script se frena). `fila`: cómo aparece en la tabla de la página del BCU
// (null: la página no la muestra con fecha). `escala`: el valor se publica por
// esa cantidad de unidades de la moneda. `min`/`max`: rango plausible en pesos
// uruguayos ya escalado; fuera de eso es otra moneda u otra unidad.
// `difCompraVenta`: compra y venta del mismo día difieren menos de 1%; si
// difieren más que esto, uno de los dos está mal tipeado en la fuente (el
// 27/04/2000 el BCU publica para el dólar compra 11,9 y venta 1,905): en años
// cerrados ese día no entra en el promedio y queda anotado; en el año en curso
// el script se frena. `salto`: un último dato que se aleja más que esto del
// promedio del mes anterior es casi seguro un error de datos.
const MONEDAS = [
  {
    id: "dolar", codigo: 2225, nombre: /DLS\. USA BILLETE/, fila: "DLS. USA BILLETE",
    texto: "dólar billete interbancario", escala: 1, min: 5, max: 150, difCompraVenta: 0.05, salto: 0.15,
  },
  {
    id: "real", codigo: 1001, nombre: /REAL BILLETE/, fila: "REAL BILLETE",
    texto: "real brasileño billete", escala: 1, min: 3, max: 30, difCompraVenta: 0.05, salto: 0.15,
  },
  {
    id: "euro", codigo: 1111, nombre: /EURO/, fila: null,
    texto: "euro", escala: 1, min: 8, max: 150, difCompraVenta: 0.05, salto: 0.15,
  },
  {
    // El BCU publica el peso argentino con tres decimales (0,027 pesos
    // uruguayos): se expresa por cada 1.000 pesos argentinos para que se lea.
    // En la crisis argentina (diciembre de 2001 a mayo de 2002) el BCU publica
    // compra y venta hasta 40% separadas: es real, no un error de tipeo, así
    // que el control de coherencia es más amplio y se usa la venta, como en
    // toda la serie.
    id: "peso-argentino", codigo: 501, nombre: /PESO ARG\.BILLETE/, fila: "PESO ARG.BILLETE",
    texto: "peso argentino billete", escala: 1000, porCada: ", por cada 1.000 pesos argentinos",
    min: 10, max: 20000, difCompraVenta: 0.5, salto: 0.25,
    notaSerie: " En la crisis argentina, de diciembre de 2001 a mayo de 2002, el BCU publica compra y venta muy separadas; se usa la venta, como en el resto de la serie.",
  },
];

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

const redondear = (n) => Math.round(n * 1000) / 1000;

/** Cotizaciones de una moneda entre dos fechas (como máximo un año). */
async function cotizaciones(m, desde, hasta, excluidos) {
  const xml = await post(
    WS,
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">` +
      `<soapenv:Body><cot:wsbcucotizaciones.Execute><cot:Entrada>` +
      `<cot:Moneda><cot:item>${m.codigo}</cot:item></cot:Moneda>` +
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
    if (moneda !== m.codigo || !m.nombre.test(nombre))
      fail(`se pidió ${m.texto} (${m.codigo}) y vino ${moneda} "${nombre}"`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "")) fail(`fecha mal formada: "${fecha}"`);
    // Algún día el BCU publica la cotización en 0 (el euro, el 17/04/2014): es
    // un dato faltante, se trata como un error de tipeo.
    if (!(venta > 0 && compra > 0) || Math.abs(venta / compra - 1) > m.difCompraVenta) {
      if (fecha.slice(0, 4) >= TODAY.slice(0, 4))
        fail(`${m.texto}: el ${fecha} la venta (${venta}) y la compra (${compra}) no son coherentes`);
      excluidos.push({ fecha, venta, compra });
      continue;
    }
    const valor = redondear(venta * m.escala);
    if (!(valor >= m.min && valor <= m.max)) fail(`${m.texto} fuera de rango el ${fecha}: ${valor}`);
    filas.push({ fecha, venta, valor });
  }
  return { error: null, filas };
}

const promedio = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000;

/** Descarga año por año y calcula los promedios y el último dato de una moneda. */
async function serie(m) {
  const excluidos = [];
  const anioActual = Number(TODAY.slice(0, 4));
  const dias = [];
  for (let anio = DESDE_ANIO; anio <= anioActual; anio++) {
    const hasta = anio === anioActual ? TODAY : `${anio}-12-31`;
    const { error, filas } = await cotizaciones(m, `${anio}-01-01`, hasta, excluidos);
    // El 1º de enero todavía no hay cotizaciones del año: solo es un error si
    // falta un año completo.
    if (error && anio < anioActual) fail(`${m.texto}, ${anio}: ${error}`);
    if (anio < anioActual && filas.length < 200) fail(`${m.texto}: ${anio} trae solo ${filas.length} días hábiles`);
    dias.push(...filas);
  }
  for (let i = 1; i < dias.length; i++) {
    if (dias[i].fecha <= dias[i - 1].fecha)
      fail(`${m.texto}: fechas fuera de orden: ${dias[i - 1].fecha} → ${dias[i].fecha}`);
  }

  const agrupar = (largo) => {
    const g = new Map();
    for (const d of dias) {
      const k = d.fecha.slice(0, largo);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(d.valor);
    }
    return g;
  };

  const ultimo = dias[dias.length - 1];
  const mesUltimo = ultimo.fecha.slice(0, 7);
  // Cierre del mes anterior al del último dato: contra él se mide la variación.
  const cierre = [...dias].reverse().find((d) => d.fecha.slice(0, 7) < mesUltimo);
  if (!cierre) fail(`${m.texto}: no hay cotizaciones del mes anterior`);

  const anuales = [...agrupar(4)]
    .filter(([anio]) => Number(anio) < anioActual)
    .map(([anio, xs]) => ({ periodo: anio, valor: promedio(xs) }));
  // Meses completos: todos menos el del último dato.
  const mensuales = [...agrupar(7)]
    .filter(([mes]) => mes >= DESDE_MES && mes < mesUltimo)
    .map(([mes, xs]) => {
      if (xs.length < 15) fail(`${m.texto}: ${mes} trae solo ${xs.length} días hábiles`);
      return { periodo: mes, valor: promedio(xs) };
    });

  const refMes = mensuales[mensuales.length - 1];
  if (Math.abs(ultimo.valor / refMes.valor - 1) > m.salto)
    fail(`${m.texto}: el último dato (${ultimo.valor}) se aleja demasiado del promedio de ${refMes.periodo} (${refMes.valor})`);

  return { m, dias, excluidos, ultimo, cierre, anuales, mensuales, refMes };
}

const series = [];
for (const m of MONEDAS) series.push(await serie(m));

// ── Verificación contra la página del BCU ───────────────────────────────────
// La tabla muestra "DLS. USA BILLETE 23/10/2026 40,078 40,078 1" (venta,
// compra, arbitraje), igual para el real y el peso argentino. El euro solo
// aparece en el recuadro lateral, sin fecha ("Euro 44,8633"): se compara con
// el último dato y, si no coincide, solo se avisa. Si el día que muestra la
// tabla coincide con el último del servicio, el valor tiene que ser el mismo.
try {
  const html = await (
    await fetch(PAGINA, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)" },
    })
  ).text();
  const texto = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const num = (s) => Number(s.replace(",", "."));
  for (const { m, dias, ultimo } of series) {
    if (!m.fila) {
      const r = texto.match(/Euro ([\d,]+)/);
      if (!r) console.warn(`AVISO: no se encontró el ${m.texto} en la página de cotizaciones del BCU`);
      else if (Math.abs(num(r[1]) - ultimo.venta) > 0.0005)
        console.warn(`AVISO: la página del BCU muestra ${m.texto} ${r[1]} (sin fecha) y el último del servicio es ${ultimo.venta} (${ultimo.fecha})`);
      else console.log(`Página del BCU verificada: ${m.texto} ${ultimo.venta}`);
      continue;
    }
    const fila = m.fila.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const r = texto.match(new RegExp(`${fila} (\\d{2})/(\\d{2})/(\\d{4}) (\\d+,\\d+)`));
    if (!r) {
      console.warn(`AVISO: no se encontró ${m.texto} en la página de cotizaciones del BCU`);
      continue;
    }
    const fecha = `${r[3]}-${r[2]}-${r[1]}`;
    const venta = num(r[4]);
    const delServicio = dias.find((d) => d.fecha === fecha);
    if (!delServicio) console.warn(`AVISO: la página del BCU muestra ${m.texto} del ${fecha}, que el servicio todavía no trae`);
    else if (Math.abs(delServicio.venta - venta) > 0.0005)
      fail(`la página del BCU dice ${venta} para ${m.texto} el ${fecha} y el servicio, ${delServicio.venta}`);
    else console.log(`Página del BCU verificada: ${m.texto} ${fecha} ${venta}`);
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
const fmt = (n) => String(n).replace(".", ",");

const lines = [];
for (const { m, excluidos, ultimo, cierre, anuales, mensuales } of series) {
  const linea = (period, periodLabel, value, status, notes) =>
    `  { indicatorId: ${JSON.stringify(m.id)}, territoryId: "UY", period: ${JSON.stringify(period)}, periodLabel: ${JSON.stringify(periodLabel)}, value: ${value}, status: "${status}", demo: false, sourceUrl: ${JSON.stringify(PAGINA)}, retrievedAt: "${TODAY}", notes: ${JSON.stringify(notes)} },`;
  const porCada = m.porCada ?? "";
  const notaDia = (f) => `Cotización del BCU para el ${fechaCorta(f)}: ${m.texto}, valor vendedor${porCada}.`;
  // Una sola nota para toda la serie anual (la página la muestra debajo del
  // gráfico, sin repetirla por año).
  const notaAnual =
    `Promedio de las cotizaciones diarias de cada año (${m.texto} del BCU, valor vendedor${porCada}). Cálculo de realidad.uy.` +
    (m.notaSerie ?? "") +
    excluidos
      .map((e) =>
        e.venta > 0 && e.compra > 0
          ? ` Se excluye el ${fechaCorta(e.fecha)}: el BCU publica compra ${fmt(e.compra)} y venta ${fmt(e.venta)}, un error de tipeo.`
          : ` Se excluye el ${fechaCorta(e.fecha)}: el BCU publica la cotización en 0.`
      )
      .join("");
  const notaMensual = `Promedio de las cotizaciones diarias del mes (${m.texto} del BCU, valor vendedor${porCada}). Cálculo de realidad.uy.`;
  lines.push(
    `  // ── ${m.texto} (código ${m.codigo}) ──`,
    "  // Promedio anual (gráfico de evolución)",
    ...anuales.map((a) => linea(a.periodo, `${a.periodo} (promedio anual)`, a.valor, "CALCULATED", notaAnual)),
    "  // Promedio mensual",
    ...mensuales.map((x) => linea(x.periodo, `${mesLargo(x.periodo)} (promedio)`, x.valor, "CALCULATED", notaMensual)),
    "  // Diario: cierre del mes anterior y último dato (titular y variación)",
    linea(cierre.fecha, fechaLarga(cierre.fecha), cierre.valor, "OFFICIAL", `${notaDia(cierre.fecha)} Último día hábil de ${mesLargo(cierre.fecha.slice(0, 7)).toLowerCase()}.`),
    linea(ultimo.fecha, fechaLarga(ultimo.fecha), ultimo.valor, "OFFICIAL", notaDia(ultimo.fecha))
  );
}

const file = `import type { Observation } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-bcu-cotizaciones.mjs — no editar a mano.
// Última ejecución: ${TODAY}. Fuente: BCU, servicio web de cotizaciones (valor
// vendedor del mercado interbancario): ${MONEDAS.map((m) => `${m.texto} (${m.codigo})`).join(", ")}.
// El último dato se verificó contra la página de cotizaciones del BCU.

export const bcuCotizacionesObservations: Observation[] = [
${lines.join("\n")}
];
`;

await writeFile(OUT, file);
for (const { m, excluidos, ultimo, cierre, anuales, mensuales, refMes } of series) {
  for (const e of excluidos) console.warn(`AVISO: ${m.texto}: se excluye el ${e.fecha} (compra ${e.compra}, venta ${e.venta})`);
  console.log(
    `${m.texto} → ${m.id}: ${anuales.length} años (${anuales[0].periodo}–${anuales[anuales.length - 1].periodo}), ${mensuales.length} meses (${mensuales[0].periodo}–${refMes.periodo}), último ${ultimo.fecha} ${ultimo.valor} (cierre ${cierre.fecha} ${cierre.valor})`
  );
}
