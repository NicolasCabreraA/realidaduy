import type { SixthGradeChoice, Territory } from "@/lib/types";
import { getSixthGrade, getTechnicalCourses, mediaMecFuente } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import TableWrap from "@/components/ui/TableWrap";

const pct = (parte: number, total: number) => `${formatNumber((parte / total) * 100, 1)}%`;
const totalDe = (s: SixthGradeChoice) => s.publica + (s.privada ?? 0);

/**
 * Educación media superior en un departamento: qué opción eligen en 6º de liceo
 * y cuántos cursan en UTU, según el anuario del MEC. Es la antesala de la
 * universidad: muestra hacia qué áreas se orientan antes de elegir carrera.
 */
export default function MediaSuperior({ dept }: { dept: Territory }) {
  const sexto = getSixthGrade(dept.id);
  const total = sexto.reduce((s, x) => s + totalDe(x), 0);
  const publica = sexto.reduce((s, x) => s + x.publica, 0);
  const grupos = [
    { titulo: "Reformulación 2006 · liceos públicos y privados", plan: "Reformulación 2006" },
    { titulo: "Plan 94 · liceos públicos", plan: "Plan 94" },
  ].map((g) => ({
    ...g,
    filas: sexto.filter((s) => s.plan === g.plan && totalDe(s) > 0).sort((a, b) => totalDe(b) - totalDe(a)),
  }));
  const utu = getTechnicalCourses(dept.id);
  const totalUtu = utu.reduce((s, u) => s + u.publica + u.privada, 0);
  const privadaUtu = utu.reduce((s, u) => s + u.privada, 0);

  const enlace = "text-primary underline decoration-line underline-offset-2 hover:decoration-primary";
  const tarjeta = "rounded-2xl border border-line bg-surface p-4 shadow-card";
  const fuente = (
    <a className={enlace} href={mediaMecFuente.sourceUrl} rel="noopener noreferrer" target="_blank">
      {mediaMecFuente.cita}
    </a>
  );

  return (
    <section aria-labelledby="media-superior" className="mt-10">
      <h2 id="media-superior" className="font-display text-2xl font-bold">
        Educación media superior
      </h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={tarjeta}>
          <h3 className="font-display text-lg font-bold">Qué opción eligen en 6º de liceo</h3>
          <p className="mt-1 text-sm text-ink-soft">
            En {mediaMecFuente.periodo} había <strong className="tnum text-ink">{formatNumber(total)}</strong>{" "}
            estudiantes en 6º de liceo en {dept.name}
            {total === publica ? (
              ", todos en liceos públicos."
            ) : (
              <>
                : <span className="tnum">{formatNumber(publica)}</span> en liceos públicos y{" "}
                <span className="tnum">{formatNumber(total - publica)}</span> en privados.
              </>
            )}
          </p>
          <TableWrap label={`Estudiantes de 6º de liceo en ${dept.name} por opción`} className="mt-3">
            <table className="tabla min-w-[300px]">
              <caption className="sr-only">
                Estudiantes de 6º de liceo en {dept.name} por opción, {mediaMecFuente.periodo}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Opción</th>
                  <th scope="col" className="num">Estudiantes</th>
                  <th scope="col" className="num">%</th>
                </tr>
              </thead>
              {grupos
                .filter((g) => g.filas.length > 0)
                .map((g) => (
                  <tbody key={g.plan}>
                    <tr>
                      <th scope="rowgroup" colSpan={3} className="bg-canvas px-[14px] py-1.5 !text-left !text-xs !font-semibold uppercase tracking-wider text-ink-faint">
                        {g.titulo}
                      </th>
                    </tr>
                    {g.filas.map((s) => (
                      <tr key={s.option}>
                        <td>{s.option}</td>
                        <td className="num">{formatNumber(totalDe(s))}</td>
                        <td className="num">{pct(totalDe(s), total)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
            </table>
          </TableWrap>
          <p className="mt-3 text-xs text-ink-faint">
            Fuente: {fuente} (cuadros II-4.2.8 y II-4.2.9). % sobre el total de 6º. La educación pública
            tiene dos planes con opciones distintas; en los liceos privados el anuario da las opciones de
            la Reformulación 2006 para todos los planes juntos. El anuario abrevia las del Plan 94 (3º
            DER, 3º ECO, 3º AGR, 3º MED, 3º ARQ, 3º ING). No se muestran las opciones sin estudiantes.
          </p>
        </div>

        <div className={tarjeta}>
          <h3 className="font-display text-lg font-bold">Media superior en UTU</h3>
          {totalUtu > 0 ? (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                En {mediaMecFuente.periodo} había <strong className="tnum text-ink">{formatNumber(totalUtu)}</strong>{" "}
                estudiantes de educación media superior en UTU (DGETP) en {dept.name}
                {privadaUtu > 0 ? `, ${formatNumber(privadaUtu)} de ellos en cursos privados` : ""}.
              </p>
              <dl className="mt-3 space-y-1.5 text-sm">
                {utu.map((u) => (
                  <div key={u.course} className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink-soft">{u.course}</dt>
                    <dd className="tnum font-semibold">
                      {formatNumber(u.publica + u.privada)} · {pct(u.publica + u.privada, totalUtu)}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              El anuario no registra estudiantes de media superior en UTU en {dept.name}.
            </p>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            Fuente: {fuente} (cuadro II-4.2.2), por tipo de curso. Las áreas de estudio de UTU (servicios,
            tecnologías de la información, administración de empresas, etc.) el anuario las da solo para
            todo el país (cuadro II-4.2.4), no por departamento.
          </p>
        </div>
      </div>
    </section>
  );
}
