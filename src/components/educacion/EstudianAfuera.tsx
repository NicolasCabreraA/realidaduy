import type { Territory } from "@/lib/types";
import { formaUdelarFuente, getCareersAbroad } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { TablaPlegable, oracion } from "@/components/educacion/EducacionTerciaria";

/**
 * Qué carreras de la UdelaR cursan fuera del departamento quienes vivían en él
 * (FormA): sirve para ver qué oferta falta en el departamento.
 */
export default function EstudianAfuera({ dept }: { dept: Territory }) {
  const { carreras, resumen } = getCareersAbroad(dept.id);
  if (!resumen || resumen.personas === 0) return null;
  const noSeDictan = carreras.filter((c) => c.enOrigen === 0).length;
  const enlace = "text-primary underline decoration-line underline-offset-2 hover:decoration-primary";

  return (
    <section aria-labelledby="afuera" className="mt-10">
      <h2 id="afuera" className="font-display text-2xl font-bold">
        Qué estudian afuera los de {dept.name}
      </h2>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <p className="text-sm text-ink-soft">
          <strong className="tnum text-ink">{formatNumber(resumen.personas)}</strong> personas que vivían
          en {dept.name} el año antes de ingresar a la UdelaR cursan carreras en otro departamento, en{" "}
          {formatNumber(resumen.carreras)} carreras.
          {carreras.length > 0
            ? ` Abajo, las ${carreras.length} con al menos 10 personas; ${noSeDictan} de ellas no se dictan en ${dept.name}.`
            : ""}
        </p>
        {carreras.length > 0 ? (
          <TablaPlegable
            label={`Carreras que cursan fuera de ${dept.name} quienes vivían ahí, 2025`}
            minWidth="min-w-[520px]"
            verTodas={`Ver las ${carreras.length} carreras`}
            head={
              <tr>
                <th scope="col">Carrera</th>
                <th scope="col" className="num">Personas</th>
                <th scope="col" className="num">Montevideo</th>
                <th scope="col" className="num">Salto</th>
                <th scope="col" className="num">Otros</th>
                <th scope="col" className="num">En {dept.name}</th>
              </tr>
            }
            rows={carreras.map((c) => (
              <tr key={c.careerCode}>
                <td>{oracion(c.career)}</td>
                <td className="num">{formatNumber(c.personas)}</td>
                <td className="num">{formatNumber(c.montevideo)}</td>
                <td className="num">{formatNumber(c.salto)}</td>
                <td className="num">{formatNumber(c.otros)}</td>
                <td className="num">
                  {c.enOrigen === 0 ? <strong className="text-ink">No se dicta</strong> : formatNumber(c.enOrigen)}
                </td>
              </tr>
            ))}
          />
        ) : null}
        <p className="mt-3 text-xs text-ink-faint">
          Fuente: lo que declaran los estudiantes en el{" "}
          <a className={enlace} href={formaUdelarFuente.sourceUrl} rel="noopener noreferrer" target="_blank">
            {formaUdelarFuente.cita}
          </a>
          . Solo carreras de grado (sin ciclos iniciales). «Personas» cuenta a cada estudiante una vez por
          carrera; Montevideo, Salto y Otros son inscripciones según dónde cursa, y quien cursa en dos
          departamentos cuenta en los dos. «En {dept.name}»: inscripciones de esa carrera en {dept.name},
          vengan de donde vengan; «No se dicta» = ninguna.
          {resumen.otrasCarreras > 0
            ? ` No se listan ${resumen.otrasCarreras} carreras con menos de 10 personas cada una (${formatNumber(resumen.otrasPersonas)} personas en total).`
            : ""}
        </p>
      </div>
    </section>
  );
}
