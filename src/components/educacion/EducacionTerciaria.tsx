import Link from "next/link";
import type { CareerEnrollment, Territory } from "@/lib/types";
import { departments } from "@/data/territories";
import {
  formaUdelarFuente,
  getCareers,
  getCareerWork,
  getStudentFlows,
  getStudentOrigin,
  getTechnicalTertiary,
} from "@/lib/data";
import { formatNumber } from "@/lib/format";
import RankingList from "@/components/charts/RankingList";
import TableWrap from "@/components/ui/TableWrap";

const VISIBLES = 10; // filas antes de "Ver todas"
const MIN_PERSONAS_ORIGEN = 100; // mismo umbral que el indicador de captación
const IMPO_CIO = "https://www.impo.com.uy/revista/ciclos-iniciales-optativos/";

const pct = (parte: number, total: number) => `${formatNumber((parte / total) * 100, 1)}%`;
const nombreDepto = (id: string) =>
  id === "EXT" ? "Otro país" : (departments.find((d) => d.id === id)?.name ?? id);
/** "DOCTOR EN MEDICINA" → "Doctor en medicina" (el FormA trae los nombres en mayúsculas). */
const oracion = (s: string) => s.charAt(0) + s.slice(1).toLocaleLowerCase("es");

/** Marcas de las filas que el anuario informa con alguna salvedad. */
function salvedad(c: CareerEnrollment): string | null {
  if (c.notes?.includes("dato a confirmar con el MEC"))
    return `${c.career} (${c.institution}): el anuario informa ${formatNumber(c.ingresos ?? 0)} ingresos y una matrícula de ${formatNumber(c.matricula)}, que por definición los incluye. Dato a confirmar con el MEC.`;
  if (c.unit === null)
    return `${c.career} (${c.institution}): estos estudiantes figuran solo en una nota del cuadro, sin desglose de egresos.`;
  return null;
}

/** Institución y sede debajo del nombre de la carrera (así la tabla entra en el celular). */
function Institucion({ c }: { c: CareerEnrollment }) {
  const sede = c.unit && c.unit !== c.career ? c.unit : null;
  const incluye = c.notes?.match(/La categoría \S+ incluye (.+?)\./)?.[1];
  return (
    <>
      <span className="block text-xs font-normal text-ink-faint">
        {c.institution}
        {sede ? ` · ${sede}` : ""}
      </span>
      {incluye ? <span className="block text-xs font-normal text-ink-faint">Incluye {incluye}</span> : null}
    </>
  );
}

/** Tabla que muestra las primeras filas y pliega el resto en "Ver todas" (sin JS). */
function TablaPlegable({
  label,
  minWidth,
  head,
  rows,
  verTodas,
}: {
  label: string;
  minWidth: string;
  head: React.ReactNode;
  rows: React.ReactNode[];
  verTodas: string;
}) {
  return (
    <>
      <TableWrap label={label} className="mt-3">
        <table className={`tabla ${minWidth}`}>
          <caption className="sr-only">{label}</caption>
          <thead>{head}</thead>
          <tbody>{rows.slice(0, VISIBLES)}</tbody>
        </table>
      </TableWrap>
      {rows.length > VISIBLES ? (
        <details className="fold mt-2">
          <summary className="pressable inline-block rounded-lg text-sm font-semibold text-primary">
            {verTodas}
          </summary>
          <TableWrap label={`${label} (resto)`} className="mt-2">
            <table className={`tabla ${minWidth}`}>
              <caption className="sr-only">{label} (resto)</caption>
              <thead>{head}</thead>
              <tbody>{rows.slice(VISIBLES)}</tbody>
            </table>
          </TableWrap>
        </details>
      ) : null}
    </>
  );
}

function TablaCarreras({ filas, total, dept }: { filas: CareerEnrollment[]; total: number; dept: Territory }) {
  const notas = filas.map(salvedad);
  const fila = (c: CareerEnrollment, i: number) => {
    const marca = notas[i] ? notas.slice(0, i + 1).filter(Boolean).length : null;
    return (
      <tr key={i}>
        <td>
          {c.career}
          {marca ? <sup className="ml-0.5 text-ink-faint">{marca}</sup> : null}
          <Institucion c={c} />
        </td>
        <td className="num">{formatNumber(c.matricula)}</td>
        <td className="num">{pct(c.matricula, total)}</td>
        <td className="num">{c.egresos === null ? "—" : formatNumber(c.egresos)}</td>
      </tr>
    );
  };
  return (
    <>
      <TablaPlegable
        label={`Carreras públicas en ${dept.name} por matrícula, 2024`}
        minWidth="min-w-[340px]"
        verTodas={`Ver las ${filas.length} carreras`}
        head={
          <tr>
            <th scope="col">Carrera</th>
            <th scope="col" className="num">Matrícula</th>
            <th scope="col" className="num">%</th>
            <th scope="col" className="num">Egresos</th>
          </tr>
        }
        rows={filas.map(fila)}
      />
      {notas.some(Boolean) ? (
        <ol className="mt-2 space-y-0.5 text-xs text-ink-faint">
          {notas.filter(Boolean).map((n, i) => (
            <li key={i}>
              <sup>{i + 1}</sup> {n}
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

/**
 * Educación terciaria pública en un departamento: carreras por matrícula (MEC),
 * vínculo de sus estudiantes con el trabajo y de dónde vienen (FormA de la UdelaR).
 */
export default function EducacionTerciaria({ dept }: { dept: Territory }) {
  const carreras = getCareers(dept.id);
  const total = carreras.reduce((s, c) => s + c.matricula, 0);
  // Las filas con matrícula 0 no aportan al ranking, salvo que el anuario las marque.
  const filas = carreras.filter((c) => c.matricula > 0 || salvedad(c));
  const ocultas = carreras.length - filas.length;
  const matriculaDe = (inst: string) =>
    carreras.filter((c) => c.institution.startsWith(inst)).reduce((s, c) => s + c.matricula, 0);
  const porInstitucion = [
    { nombre: "la UdelaR", n: matriculaDe("UdelaR") },
    { nombre: "la UTEC", n: matriculaDe("UTEC") },
    { nombre: "formación docente", n: matriculaDe("Formación en Educación") },
  ].filter((x) => x.n > 0);
  const hayUdelar = carreras.some((c) => c.institution === "UdelaR");
  const hayUniversidad = carreras.some((c) => c.institution === "UdelaR" || c.institution === "UTEC");
  const hayDocente = carreras.some((c) => c.institution.startsWith("Formación en Educación"));
  const anuarioUrl = carreras[0]?.sourceUrl;
  const hayCio = filas.some((c) => c.career.startsWith("CIO "));

  const utuTerciaria = getTechnicalTertiary(dept.id);
  const trabajo = getCareerWork(dept.id);
  const llegan = getStudentFlows(dept.id, "llegan");
  const totalLlegan = llegan.reduce((s, f) => s + f.personas, 0);
  const origen = getStudentOrigin(dept.id);
  const salenAOtros = getStudentFlows(dept.id, "salen").filter((f) => f.destinationId !== dept.id);
  const esMontevideo = dept.id === "UY-MO";

  const enlace = "text-primary underline decoration-line underline-offset-2 hover:decoration-primary";
  const tarjeta = "rounded-2xl border border-line bg-surface p-4 shadow-card";

  return (
    <section aria-labelledby="terciaria" className="mt-10">
      <h2 id="terciaria" className="font-display text-2xl font-bold">
        Educación terciaria pública
      </h2>

      {/* Carreras por matrícula — MEC */}
      <div className={`${tarjeta} mt-4`}>
        <h3 className="font-display text-lg font-bold">Carreras con más estudiantes</h3>
        {total > 0 ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">
              En 2024 hubo <strong className="tnum text-ink">{formatNumber(total)}</strong> inscripciones
              en carreras públicas que se dictan solo en {dept.name}
              {porInstitucion.length > 1
                ? `: ${porInstitucion
                    .map((x) => `${formatNumber(x.n)} en ${x.nombre}`)
                    .join(", ")
                    .replace(/, ([^,]*)$/, " y $1")}.`
                : `, todas en ${porInstitucion[0].nombre}.`}
            </p>
            <TablaCarreras filas={filas} total={total} dept={dept} />
            <p className="mt-3 text-xs text-ink-faint">
              Fuente:{" "}
              <a className={enlace} href={anuarioUrl} rel="noopener noreferrer" target="_blank">
                MEC, Anuario Estadístico de Educación 2024
              </a>{" "}
              ({hayUniversidad && hayDocente ? "cuadros II-7.2.1 y II-6.2.1" : hayUniversidad ? "cuadro II-7.2.1" : "cuadro II-6.2.1"}).
              Nombres de carrera tal como figuran en el anuario. % sobre las {formatNumber(total)}{" "}
              inscripciones.
              {hayUdelar ? " Egresos de la UdelaR preliminares, según el anuario." : ""}
              {hayDocente
                ? " En formación docente, la matrícula es el número de inscripciones para cursar al menos una materia."
                : ""}{" "}
              No incluye carreras dictadas entre dos departamentos, la educación terciaria de UTU ni las
              instituciones privadas.
              {ocultas === 1 ? " No se muestra 1 fila que el anuario lista con matrícula 0." : ""}
              {ocultas > 1 ? ` No se muestran ${ocultas} filas que el anuario lista con matrícula 0.` : ""}
              {hayCio ? (
                <>
                  {" "}
                  Los CIO (ciclos iniciales optativos) son una puerta de ingreso a la UdelaR desde la que se
                  sigue en distintas carreras (
                  <a className={enlace} href={IMPO_CIO} rel="noopener noreferrer" target="_blank">
                    IMPO
                  </a>
                  ).
                </>
              ) : null}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            El anuario del MEC no registra carreras públicas que se dicten solo en {dept.name}.
          </p>
        )}
        {utuTerciaria !== undefined && utuTerciaria > 0 ? (
          <p className="mt-3 border-t border-line pt-3 text-sm text-ink-soft">
            Aparte, UTU (DGETP) tenía una matrícula de{" "}
            <strong className="tnum text-ink">{formatNumber(utuTerciaria)}</strong> en cursos terciarios no
            universitarios en {dept.name}. El anuario no la desagrega por carrera (cuadro II-5.1.1).
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* De dónde vienen — FormA */}
        <div className={tarjeta}>
          <h3 className="font-display text-lg font-bold">
            De dónde vienen los estudiantes de la UdelaR en {dept.name}
          </h3>
          {totalLlegan >= MIN_PERSONAS_ORIGEN ? (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                Dónde vivían el año antes de ingresar las{" "}
                <span className="tnum">{formatNumber(totalLlegan)}</span> personas que cursan en{" "}
                {dept.name}.
              </p>
              <div className="mt-3">
                <RankingList
                  entries={llegan.slice(0, 8).map((f) => ({
                    label: f.originId === dept.id ? `${dept.name} (de acá)` : nombreDepto(f.originId),
                    value: f.personas,
                    display: `${formatNumber(f.personas)} · ${pct(f.personas, totalLlegan)}`,
                  }))}
                />
              </div>
              {llegan.length > 8 ? (
                <p className="mt-2 text-xs text-ink-faint">
                  Otros {llegan.length - 8} orígenes:{" "}
                  {formatNumber(llegan.slice(8).reduce((s, f) => s + f.personas, 0))} personas.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              {totalLlegan === 0
                ? `Ninguna persona declara cursar en la UdelaR en ${dept.name}.`
                : `Menos de ${MIN_PERSONAS_ORIGEN} personas cursan en la UdelaR en ${dept.name} (${formatNumber(totalLlegan)}).`}
            </p>
          )}
        </div>

        {/* Dónde cursan los que vivían en el departamento — FormA */}
        {origen ? (
          <div className={tarjeta}>
            <h3 className="font-display text-lg font-bold">
              Dónde cursan los estudiantes de {dept.name}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Las <span className="tnum">{formatNumber(origen.personas)}</span> personas que vivían en{" "}
              {dept.name} el año antes de ingresar a la UdelaR.
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              {[
                { etiqueta: `Solo en ${dept.name}`, n: origen.soloEnDepartamento },
                { etiqueta: `En ${dept.name} y en otro departamento`, n: origen.enDepartamentoYOtro },
                ...(esMontevideo ? [] : [{ etiqueta: "Solo en Montevideo", n: origen.soloMontevideo }]),
                {
                  etiqueta: esMontevideo ? "Solo en otros departamentos" : "En otros departamentos",
                  n: origen.otros,
                },
              ].map(({ etiqueta, n }) => (
                <div key={etiqueta} className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-soft">{etiqueta}</dt>
                  <dd className="tnum font-semibold">
                    {formatNumber(n)} · {pct(n, origen.personas)}
                  </dd>
                </div>
              ))}
            </dl>
            {salenAOtros.length > 0 ? (
              <p className="mt-3 text-xs text-ink-soft">
                Cursan fuera de {dept.name}:{" "}
                {salenAOtros
                  .slice(0, 4)
                  .map((f) => `${nombreDepto(f.destinationId)} ${formatNumber(f.personas)}`)
                  .join(" · ")}
                {salenAOtros.length > 4 ? " · …" : "."}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Vínculo con el trabajo — FormA */}
      {trabajo.length > 0 ? (
        <div className={`${tarjeta} mt-4`}>
          <h3 className="font-display text-lg font-bold">
            Cuántos estudiantes de la UdelaR ya trabajan
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Por carrera, en {dept.name}. Son estudiantes, no egresados: muestra cuántos trabajan mientras
            estudian, no cuánta demanda de trabajo hay para cada carrera.
          </p>
          <TablaPlegable
            label={`Estudiantes de la UdelaR en ${dept.name} que trabajan, por carrera, 2025`}
            minWidth="min-w-[340px]"
            verTodas={`Ver las ${trabajo.length} carreras`}
            head={
              <tr>
                <th scope="col">Carrera</th>
                <th scope="col" className="num">Inscripciones</th>
                <th scope="col" className="num">Trabajan</th>
                <th scope="col" className="num">Relacionado</th>
              </tr>
            }
            rows={trabajo.map((t) => (
              <tr key={t.careerCode}>
                <td>{oracion(t.career)}</td>
                <td className="num">{formatNumber(t.inscripciones)}</td>
                <td className="num">{formatNumber(t.trabajan, 1)}%</td>
                <td className="num">
                  {t.relacionada === null ? "—" : `${formatNumber(t.relacionada, 1)}%`}
                </td>
              </tr>
            ))}
          />
          <p className="mt-3 text-xs text-ink-faint">
            Fuente: lo que declaran los estudiantes en el{" "}
            <a className={enlace} href={formaUdelarFuente.sourceUrl} rel="noopener noreferrer" target="_blank">
              {formaUdelarFuente.cita}
            </a>
            . Carreras con al menos 30 inscripciones en {dept.name}; no incluye ciclos iniciales. “Trabajan”:
            con trabajo remunerado, sobre quienes respondieron. “Relacionado”: con un trabajo muy o
            bastante relacionado con la carrera, sobre quienes trabajan y respondieron (— si responden menos de 10).
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-ink-faint">
        Origen y destino: {formaUdelarFuente.cita}, sobre las personas que informaron dónde vivían el año
        antes de ingresar. Quien cursa en dos departamentos cuenta en los dos. La matrícula por carrera
        (anuario del MEC, 2024) y el origen y el trabajo de los estudiantes (FormA, 2025) son fuentes y
        años distintos: sus cifras no coinciden exactamente. Rankings de los 19
        departamentos:{" "}
        <Link className={enlace} href="/indicadores/matricula-universidad-publica">
          matrícula
        </Link>
        ,{" "}
        <Link className={enlace} href="/indicadores/udelar-captacion">
          estudiantes que llegan de afuera
        </Link>
        ,{" "}
        <Link className={enlace} href="/indicadores/udelar-retencion">
          que cursan en su departamento
        </Link>
        {esMontevideo ? null : (
          <>
            {" "}
            y{" "}
            <Link className={enlace} href="/indicadores/udelar-solo-montevideo">
              que cursan solo en Montevideo
            </Link>
          </>
        )}
        .
      </p>
    </section>
  );
}
