// Ingesta de los indicadores MENSUALES del INE: IPC, ECH (actividad, empleo y
// desempleo) e IMS. Son los únicos que cambian todos los meses y hasta ahora se
// cargaban a mano, así que la tarea automática mensual no los tocaba.
//
// Genera src/data/observations/ine-mensual.ts con provenance completo.
// Uso:
//   node scripts/ingest/fetch-ine.mjs                # desde 2024-01 hasta hoy
//   node scripts/ingest/fetch-ine.mjs --desde 2026-01
//   node scripts/ingest/fetch-ine.mjs --fresh        # ignora la caché
//
// Fuente: cada informe técnico del INE tiene una URL predecible
//   gub.uy/instituto-nacional-estadistica/comunicacion/publicaciones/<serie>-<mes>-<año>
// y una frase resumen con las cifras. El script parsea esa frase.
//
// El salario real no está en esa frase: sale del informe completo del IMS que
// la página enlaza en www5.ine.gub.uy (cuadro 2, "IPC, IMS Real…"). Antes de
// escribirlo se controla que sea el mismo informe y que cierre con la cuenta
// (1 + IMS nominal) / (1 + IPC) − 1.
//
// Filosofía (igual que el resto de la ingesta): ante la duda, romper. Si el INE
// cambia la redacción, el script FALLA en vez de escribir datos incompletos en
// silencio. Un archivo con menos observaciones que el anterior también aborta.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "src", "data", "observations", "ine-mensual.ts");
const CACHE = path.join(ROOT, "scripts", "ingest", ".cache", "ine");
const CERTS = path.join(ROOT, "scripts", "ingest", "certs", "ine-intermedios.pem");
const BASE =
  "https://www.gub.uy/instituto-nacional-estadistica/comunicacion/publicaciones";
const TODAY = new Date().toISOString().slice(0, 10);

// El WAF de gub.uy responde 403 a clientes sin User-Agent de navegador.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// "setiembre", no "septiembre": es la grafía que usa el INE en sus URLs.
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];
// El INE escribe las dos formas en el cuerpo de las páginas.
const ALIAS_MES = { septiembre: "setiembre" };

// www5.ine.gub.uy (informe completo del IMS) manda un intermedio equivocado: se
// suma el correcto, como en fetch-ine-anuales.mjs.
const intermedios = (await readFile(CERTS, "utf8")).match(
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g
);
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ...intermedios]);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DESDE = opt("--desde", "2024-01");
const FRESH = flag("--fresh");
// Los últimos meses se re-consultan siempre: el INE a veces corrige un informe
// después de publicarlo.
const REVALIDAR_MESES = 3;

/** Texto plano, sin acentos ni etiquetas: los regex quedan inmunes al encoding. */
function normalize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "0,24" → 0.24 (coma decimal del INE). */
function num(raw, campo, url) {
  const v = Number(raw.replace(/−/g, "-").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(v)) throw new Error(`No se pudo leer ${campo} ("${raw}") en ${url}`);
  return v;
}

const RANGOS = {
  "inflacion-interanual": [-10, 100],
  "tasa-desempleo": [0, 40],
  "tasa-empleo": [20, 80],
  "tasa-actividad": [20, 90],
  "indice-medio-salarios": [-20, 200],
  "salario-real": [-30, 30],
};

function checkRango(indicatorId, value, url) {
  const [min, max] = RANGOS[indicatorId];
  if (value < min || value > max) {
    throw new Error(`${indicatorId} = ${value} fuera del rango [${min}, ${max}] en ${url}`);
  }
}

const SERIES = [
  {
    key: "ipc",
    slug: "indice-precios-del-consumo-ipc",
    // "El IPC de Agosto 2026 registro una variacion mensual de 0,24%,
    //  acumulada en el ano 3,65% y en los ultimos 12 meses de 4,55%"
    re: /variacion mensual de ([-−]?[\d.,]+) ?%,? acumulada en el ano (?:de )?(?:([-−]?[\d.,]+) ?% )?y en los ultimos 12 meses (?:de )?([-−]?[\d.,]+) ?%/i,
    build([mensual, acumulada = null, interanual], ctx) {
      const acum = acumulada ?? interanual;
      return [
        {
          indicatorId: "inflacion-interanual",
          value: interanual,
          notes: `Variación mensual: ${ctx.fmt(mensual)}%. Acumulada en el año: ${ctx.fmt(acum)}%. Informe técnico del INE publicado el ${ctx.publicado}.`,
        },
      ];
    },
  },
  {
    key: "ech",
    slug: "actividad-empleo-desempleo-ech",
    // "la tasa de actividad se situo en 64,1%, la tasa de empleo en 59,6%
    //  y la tasa de desempleo en 7,0%"
    re: /tasa de actividad se situo en ([-−]?[\d.,]+) ?%,? la tasa de empleo en ([-−]?[\d.,]+) ?% y la tasa de desempleo en ([-−]?[\d.,]+) ?%/i,
    build([actividad, empleo, desempleo], ctx) {
      // Chequeo cruzado: desempleo = (actividad − empleo) / actividad × 100.
      // Si el orden de captura se rompiera, esto lo detecta.
      const esperado = ((actividad - empleo) / actividad) * 100;
      if (Math.abs(esperado - desempleo) > 0.4) {
        throw new Error(
          `ECH ${ctx.period}: desempleo ${desempleo}% no cierra con actividad ${actividad}% y empleo ${empleo}% (esperado ~${esperado.toFixed(1)}%) en ${ctx.url}`
        );
      }
      const nota = `Informe técnico del INE publicado el ${ctx.publicado}.`;
      return [
        { indicatorId: "tasa-actividad", value: actividad, notes: nota },
        { indicatorId: "tasa-empleo", value: empleo, notes: nota },
        { indicatorId: "tasa-desempleo", value: desempleo, notes: nota },
      ];
    },
  },
  {
    key: "ims",
    slug: "indice-medio-salarios",
    slugSuffix: "ims",
    re: /variacion mensual de ([-−]?[\d.,]+) ?%,? acumulada en el ano (?:de )?(?:([-−]?[\d.,]+) ?% )?y en los ultimos 12 meses (?:de )?([-−]?[\d.,]+) ?%/i,
    build([mensual, acumulada = null, interanual], ctx) {
      const acum = acumulada ?? interanual;
      return [
        {
          indicatorId: "indice-medio-salarios",
          value: interanual,
          notes: `Variación nominal interanual. Mensual: ${ctx.fmt(mensual)}%; acumulada en el año: ${ctx.fmt(acum)}%. Informe técnico del INE publicado el ${ctx.publicado}.`,
        },
      ];
    },
    completo: {
      link: /href="(https:\/\/www5\.ine\.gub\.uy\/[^"]+\.html)"/i,
      // Cuadro 2, columnas índice, mes, acumulado en el año y últimos 12 meses:
      // "Indice de precios del consumo 361,20 0,24 3,65 4,55
      //  Indice Medio de Salarios REAL 147,45 0,07 1,43 1,28"
      re: /Indice de precios del consumo [\d.,]+ [-−]?[\d.,]+ [-−]?[\d.,]+ ([-−]?[\d.,]+) Indice Medio de Salarios REAL [\d.,]+ ([-−]?[\d.,]+) ([-−]?[\d.,]+) ([-−]?[\d.,]+)/i,
      build([ipc, mensual, acumulada, interanual], [, , nominal], ctx) {
        const ipcSerie = ctx.observado("inflacion-interanual");
        if (ipcSerie !== undefined && Math.abs(ipcSerie - ipc) > 0.005) {
          throw new Error(
            `IMS ${ctx.period}: el informe completo trae un IPC de ${ipc}% y el informe del IPC, ${ipcSerie}%. Revisar ${ctx.url}`
          );
        }
        const cuenta = ((1 + nominal / 100) / (1 + ipc / 100) - 1) * 100;
        if (Math.abs(cuenta - interanual) > 0.05) {
          throw new Error(
            `IMS ${ctx.period}: salario real ${interanual}% no cierra con IMS ${nominal}% e IPC ${ipc}% (esperado ~${cuenta.toFixed(2)}%) en ${ctx.url}`
          );
        }
        return [
          {
            indicatorId: "salario-real",
            value: interanual,
            notes: `Variación real interanual: el IMS nominal (${ctx.fmt(nominal)}%) descontada la inflación (${ctx.fmt(ipc)}%). Mensual: ${ctx.fmt(mensual)}%; acumulada en el año: ${ctx.fmt(acumulada)}%. Informe técnico del INE publicado el ${ctx.publicado}, cuadro 2.`,
          },
        ];
      },
    },
  },
];

/**
 * Período REAL del informe, leído del <title> de la página.
 *
 * No se puede confiar en el slug: /…-ipc-enero-2024 responde 200 y sirve el
 * informe de DICIEMBRE 2023 (antes de 2025 el INE nombraba la publicación por
 * el mes en que salía, no por el mes al que refiere). Tomar el período de la
 * URL habría cargado los números de un mes con la etiqueta de otro.
 */
function periodoDelTitulo(html, url) {
  const raw = /<title>([\s\S]*?)<\/title>/i.exec(html);
  if (!raw) throw new Error(`Página sin <title>: ${url}`);
  const titulo = normalize(raw[1]).split("|")[0];
  const m = new RegExp(`\\b(${MESES.join("|")}|septiembre)\\s+(\\d{4})\\b`, "i").exec(titulo);
  if (!m) throw new Error(`No se pudo leer el mes del título "${titulo}": ${url}`);
  const mes = ALIAS_MES[m[1].toLowerCase()] ?? m[1].toLowerCase();
  const idx = MESES.indexOf(mes);
  return {
    period: `${m[2]}-${String(idx + 1).padStart(2, "0")}`,
    periodLabel: `${mes[0].toUpperCase()}${mes.slice(1)} ${m[2]}`,
  };
}

function urlFor(serie, year, month) {
  const slug = serie.slugSuffix ? `${serie.slug}-${serie.slugSuffix}` : serie.slug;
  return `${BASE}/${slug}-${MESES[month - 1]}-${year}`;
}

// La corrida mensual de GitHub no tiene a nadie mirando: un error pasajero de
// gub.uy no puede tirarla. Errores de red, 429 y 5xx se reintentan dos veces;
// un 404 no, porque significa que el informe todavía no salió.
const ESPERAS_MS = [3000, 10000];

async function pedir(url) {
  for (let intento = 0; ; intento++) {
    const ultimo = intento === ESPERAS_MS.length;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-UY,es" } });
      if (ultimo || (res.status !== 429 && res.status < 500)) return res;
      console.warn(`HTTP ${res.status} en ${url}: reintento`);
    } catch (err) {
      if (ultimo) throw err;
      console.warn(`${err.message} en ${url}: reintento`);
    }
    await new Promise((r) => setTimeout(r, ESPERAS_MS[intento]));
  }
}

async function getHtml(url, revalidar) {
  await mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, url.split("/").pop() + ".html");
  if (!FRESH && !revalidar && existsSync(file)) return readFile(file, "utf8");

  const res = await pedir(url);
  if (res.status === 404) return null; // todavía no publicado
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const html = await res.text();
  await writeFile(file, html);
  return html;
}

/** Texto normalizado del informe completo. Se guarda solo el texto: el HTML
 * trae los gráficos embebidos y pesa casi 5 MB por mes. */
async function getTextoCompleto(url, revalidar) {
  const file = path.join(CACHE, "completo-" + decodeURIComponent(url.split("/").pop()).replace(/[^\w.-]+/g, "-") + ".txt");
  if (!FRESH && !revalidar && existsSync(file)) return readFile(file, "utf8");

  let res;
  try {
    res = await pedir(url);
  } catch (e) {
    const code = e.cause?.code ?? "";
    if (/CERT|SIGNATURE|ISSUER/.test(code)) {
      throw new Error(
        `TLS (${code}) en ${url}: el INE cambió de certificado. Revisar scripts/ingest/certs/ine-intermedios.pem`
      );
    }
    throw e;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const texto = normalize(await res.text());
  await writeFile(file, texto);
  return texto;
}

function mesesEntre(desde, hasta) {
  const out = [];
  const [y0, m0] = desde.split("-").map(Number);
  const [y1, m1] = hasta.split("-").map(Number);
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    out.push([y, m]);
  }
  return out;
}

const hoy = new Date();
const HASTA = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
const meses = mesesEntre(DESDE, HASTA);
const revalidarDesde = meses.length - REVALIDAR_MESES;

// Clave `${indicatorId}|${period}` → observación. Dos URLs pueden resolver al
// mismo informe (ver periodoDelTitulo), así que se deduplica por período real.
const porClave = new Map();
const fmt = (n) => String(n).replace(".", ",");

for (const serie of SERIES) {
  const periodos = new Set();
  const faltantes = [];
  for (const [idx, [year, month]] of meses.entries()) {
    const url = urlFor(serie, year, month);
    const html = await getHtml(url, idx >= revalidarDesde);
    if (html === null) {
      faltantes.push(`${year}-${String(month).padStart(2, "0")}`);
      continue;
    }
    const texto = normalize(html);
    const { period, periodLabel } = periodoDelTitulo(html, url);
    // El informe puede referirse a un mes anterior al del slug: si cae fuera
    // del rango pedido, se ignora en vez de ensuciar la serie.
    if (period < DESDE || period > HASTA) continue;

    const m = serie.re.exec(texto);
    if (!m) {
      throw new Error(
        `No se pudo parsear ${serie.key} ${period}: el INE cambió la redacción. Revisar ${url}`
      );
    }
    const valores = m
      .slice(1, 4)
      .map((raw, i) => (raw === undefined ? undefined : num(raw, `campo ${i + 1}`, url)));

    const fecha = /informes tecnicos (\d{2}\/\d{2}\/\d{4})/i.exec(texto);
    const publicado = fecha ? fecha[1] : "fecha no informada";
    const ctx = {
      period, periodLabel, url, publicado, fmt,
      observado: (indicatorId) => porClave.get(`${indicatorId}|${period}`)?.value,
    };
    const nuevas = serie.build(valores, ctx);

    if (serie.completo) {
      const link = serie.completo.link.exec(html);
      if (!link) throw new Error(`${serie.key} ${period}: la página no enlaza el informe completo. Revisar ${url}`);
      const urlCompleto = new URL(link[1]).href;
      const completo = await getTextoCompleto(urlCompleto, idx >= revalidarDesde);
      // Mismo informe: su frase resumen tiene que repetir la variación interanual de la página.
      const resumen = serie.re.exec(completo);
      if (!resumen || num(resumen[3], "interanual", urlCompleto) !== valores[2]) {
        throw new Error(`${serie.key} ${period}: el informe completo no coincide con la página. Revisar ${urlCompleto}`);
      }
      const mc = serie.completo.re.exec(completo);
      if (!mc) {
        throw new Error(
          `No se pudo parsear el informe completo de ${serie.key} ${period}: el INE cambió el cuadro. Revisar ${urlCompleto}`
        );
      }
      const valoresCompleto = mc.slice(1).map((raw, i) => num(raw, `cuadro, campo ${i + 1}`, urlCompleto));
      const ctxCompleto = { ...ctx, url: urlCompleto };
      for (const o of serie.completo.build(valoresCompleto, valores, ctxCompleto)) {
        nuevas.push({ ...o, sourceUrl: urlCompleto });
      }
    }

    for (const o of nuevas) {
      checkRango(o.indicatorId, o.value, url);
      const clave = `${o.indicatorId}|${period}`;
      const previa = porClave.get(clave);
      if (previa && previa.value !== o.value) {
        throw new Error(
          `${clave}: dos informes con valores distintos (${previa.value} en ${previa.sourceUrl}, ${o.value} en ${o.sourceUrl ?? url})`
        );
      }
      porClave.set(clave, {
        ...o,
        territoryId: "UY",
        period,
        periodLabel,
        status: "OFFICIAL",
        demo: false,
        sourceUrl: o.sourceUrl ?? url,
        retrievedAt: TODAY,
      });
    }
    periodos.add(period);
  }
  if (periodos.size === 0) {
    throw new Error(`La serie ${serie.key} no devolvió ningún informe: ¿cambió la URL del INE?`);
  }
  const ultimosFaltantes = faltantes.slice(-2).join(", ");
  console.log(
    `${serie.key}: ${periodos.size} informes` +
      (faltantes.length ? ` (sin publicar: ${faltantes.length}${ultimosFaltantes ? `, últimos ${ultimosFaltantes}` : ""})` : "")
  );
}

const observaciones = [...porClave.values()];

// Nunca achicar el archivo sin querer: si hay menos datos que antes, algo falló.
if (existsSync(OUT) && !flag("--force")) {
  const previo = (await readFile(OUT, "utf8")).match(/indicatorId:/g)?.length ?? 0;
  if (observaciones.length < previo) {
    throw new Error(
      `Se generaron ${observaciones.length} observaciones y antes había ${previo}. Abortado; usar --force si el recorte es intencional.`
    );
  }
}

observaciones.sort(
  (a, b) => a.indicatorId.localeCompare(b.indicatorId) || a.period.localeCompare(b.period)
);

const lineas = observaciones.map(
  (o) =>
    `  { indicatorId: ${JSON.stringify(o.indicatorId)}, territoryId: "UY", period: ${JSON.stringify(o.period)}, periodLabel: ${JSON.stringify(o.periodLabel)}, value: ${o.value}, status: "OFFICIAL", demo: false, sourceUrl: ${JSON.stringify(o.sourceUrl)}, retrievedAt: ${JSON.stringify(o.retrievedAt)}, notes: ${JSON.stringify(o.notes)} },`
);

const porIndicador = [...new Set(observaciones.map((o) => o.indicatorId))]
  .map((id) => {
    const serie = observaciones.filter((o) => o.indicatorId === id);
    return `//   ${id}: ${serie.length} meses (${serie[0].period} → ${serie[serie.length - 1].period})`;
  })
  .join("\n");

const file = `import type { Observation } from "@/lib/types";

// GENERADO por scripts/ingest/fetch-ine.mjs — no editar a mano.
// Última ejecución: ${TODAY}. Fuente: informes técnicos del INE (IPC, ECH e IMS),
// una publicación por mes en gub.uy. El script valida el rango de cada valor y
// que el desempleo cierre con las tasas de actividad y empleo antes de escribir.
// El salario real sale del informe completo del IMS (cuadro 2) y se controla
// contra la cuenta con el IMS nominal y el IPC del mismo mes.
${porIndicador}

export const ineMensualObservations: Observation[] = [
${lineas.join("\n")}
];
`;

await writeFile(OUT, file);
console.log(`\n${observaciones.length} observaciones → ${OUT}`);
