import type { Metadata } from "next";
import Link from "next/link";
import { downloads } from "@/lib/downloads";
import { formatNumber } from "@/lib/format";
import { SITE_HOST, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Descargar datos",
  description:
    "Todos los datos de realidad.uy en CSV abierto, con fuente, período y estado de cada observación. Uso libre citando la fuente original.",
};

const completos = downloads.filter((d) => d.group === "completo");
const porIndicador = downloads.filter((d) => d.group === "indicador");

function DownloadRow({
  file,
  title,
  description,
  rows,
  href,
}: {
  file: string;
  title: string;
  description: string;
  rows: number;
  href?: string;
}) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-ink-soft">{description}</p>
          <p className="mt-1.5 text-xs text-ink-faint">
            <code className="rounded bg-canvas px-1.5 py-0.5">{file}</code> ·{" "}
            {formatNumber(rows)} filas
            {href ? (
              <>
                {" · "}
                <Link className="underline hover:text-primary" href={href}>
                  ver en el sitio
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <a
          href={`/datos/${file}`}
          download
          className="pressable shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Descargar CSV
        </a>
      </div>
    </li>
  );
}

export default function DatosPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
        Datos abiertos
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">Descargar datos</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Todo lo que se ve en la plataforma se puede bajar en CSV. Cada fila viaja con su
        procedencia completa: territorio, período, unidad, estado del dato, organismo y URL
        de la publicación original.
      </p>

      <section aria-labelledby="completos" className="mt-8">
        <h2 id="completos" className="font-display text-2xl font-bold">
          Conjuntos completos
        </h2>
        <ul className="mt-4 space-y-3">
          {completos.map((d) => (
            <DownloadRow key={d.file} {...d} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="por-indicador" className="mt-10">
        <h2 id="por-indicador" className="font-display text-2xl font-bold">
          Por indicador
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          La serie completa de un indicador en todos los territorios donde se publica.
        </p>
        <ul className="mt-4 space-y-3">
          {porIndicador.map((d) => (
            <DownloadRow key={d.file} {...d} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="insertar" className="mt-10">
        <h2 id="insertar" className="font-display text-2xl font-bold">
          Insertar un gráfico en tu sitio
        </h2>
        <div className="mt-3 space-y-3 text-ink-soft">
          <p>
            Cualquier mapa o ranking se puede publicar dentro de una nota con un iframe. El
            botón <strong>Insertar</strong> de cada indicador te da el código armado; también
            podés escribirlo a mano:
          </p>
          {/* Focalizable: en el celular el código se desliza y tiene que poder
              desplazarse con el teclado (WCAG 2.1.1). */}
          <pre
            tabIndex={0}
            aria-label="Código de ejemplo para insertar un mapa"
            className="tablewrap overflow-x-auto rounded-xl border border-line bg-canvas p-3 text-xs text-ink"
          >
            <code>{`<iframe src="${SITE_URL}/embed/mapa/desempleo"
  title="Tasa de desempleo por departamento — mapa de realidad.uy"
  width="100%" height="660" loading="lazy"
  style="border:1px solid #e0e5e9;border-radius:12px"></iframe>`}</code>
          </pre>
          <p className="text-sm">
            Rutas disponibles:{" "}
            <code className="rounded bg-canvas px-1.5 py-0.5">/embed/mapa/&lt;indicador&gt;</code>,{" "}
            <code className="rounded bg-canvas px-1.5 py-0.5">/embed/ranking/&lt;indicador&gt;</code>{" "}
            y <code className="rounded bg-canvas px-1.5 py-0.5">/embed/mapa/gobierno</code>, donde{" "}
            <code className="rounded bg-canvas px-1.5 py-0.5">&lt;indicador&gt;</code> es el de la
            URL de su página (por ejemplo{" "}
            <code className="rounded bg-canvas px-1.5 py-0.5">desempleo</code>). La pieza lleva la
            fuente y el período adentro y se actualiza sola cuando se actualiza el dato.
          </p>
        </div>
      </section>

      <section aria-labelledby="uso" className="mt-10">
        <h2 id="uso" className="font-display text-2xl font-bold">
          Formato y uso
        </h2>
        <div className="mt-3 space-y-3 text-ink-soft">
          <p>
            Los archivos son CSV en <strong>UTF-8 con BOM</strong>, separados por{" "}
            <strong>coma</strong> y con <strong>punto decimal</strong>: se abren directo en
            Excel, en Google Sheets y en pandas o R sin conversiones.
          </p>
          <p>
            Podés usarlos y republicarlos libremente, incluso con fines comerciales.
            Corresponde citar al organismo que produjo el dato (la columna{" "}
            <code className="rounded bg-canvas px-1.5 py-0.5 text-sm">fuente</code> de cada
            fila) y, si querés, a {SITE_HOST} como recopilación.
          </p>
          <p>
            Las URLs son permanentes: <code className="rounded bg-canvas px-1.5 py-0.5 text-sm">/datos/&lt;archivo&gt;.csv</code>{" "}
            va a seguir sirviendo el mismo conjunto, actualizado. Si necesitás un corte que
            no está acá, está todo en{" "}
            <a className="underline hover:text-primary" href="/datos/realidad-uy-observaciones.csv" download>
              el archivo completo
            </a>
            .
          </p>
          <p className="text-sm">
            La metodología de cada indicador está en{" "}
            <Link className="underline hover:text-primary" href="/fuentes">
              Fuentes y metodología
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
