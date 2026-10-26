import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { departments, getDepartmentBySlug } from "@/data/territories";
import { hasData, indicatorsForLevel } from "@/lib/data";
import { SITE_NAME } from "@/lib/site";
import MetricCard from "@/components/charts/MetricCard";
import EducacionTerciaria from "@/components/educacion/EducacionTerciaria";
import EstudianAfuera from "@/components/educacion/EstudianAfuera";
import MediaSuperior from "@/components/educacion/MediaSuperior";

export function generateStaticParams() {
  return departments.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dept = getDepartmentBySlug(slug);
  if (!dept) return {};
  const description = `Educación en ${dept.name}: carreras públicas, de dónde vienen los estudiantes de la UdelaR, qué estudian afuera, 6º de liceo y UTU, con fuentes verificables.`;
  return {
    title: `Educación en ${dept.name}`,
    description,
    alternates: { canonical: `/departamentos/${dept.slug}/educacion` },
    openGraph: { title: `Educación en ${dept.name} · ${SITE_NAME}`, description, url: `/departamentos/${dept.slug}/educacion` },
  };
}

/** Panel de educación de un departamento, aparte de los indicadores generales. */
export default async function EducacionDepartamento({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dept = getDepartmentBySlug(slug);
  if (!dept) notFound();
  const ids = indicatorsForLevel("departamento")
    .filter((i) => i.subCategory === "educacion" && hasData(i.id, dept.id))
    .map((i) => i.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <nav aria-label="Miga de pan" className="text-sm text-ink-faint">
        <Link className="hover:text-primary" href="/departamentos">
          Departamentos
        </Link>{" "}
        /{" "}
        <Link className="hover:text-primary" href={`/departamentos/${dept.slug}`}>
          {dept.name}
        </Link>{" "}
        / <span className="text-ink-soft">Educación</span>
      </nav>
      <h1 className="mt-2 font-display text-4xl font-bold md:text-5xl">Educación en {dept.name}</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Qué se estudia en {dept.name}, de dónde vienen sus estudiantes universitarios y qué carreras van
        a buscar a otros departamentos.
      </p>

      {ids.length > 0 ? (
        <section aria-labelledby="resumen-educacion" className="mt-8">
          <h2 id="resumen-educacion" className="font-display text-2xl font-bold">
            En números
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ids.map((id) => (
              <MetricCard key={id} indicatorId={id} territoryId={dept.id} />
            ))}
          </div>
        </section>
      ) : null}

      <EducacionTerciaria dept={dept} />
      <EstudianAfuera dept={dept} />
      <MediaSuperior dept={dept} />
    </div>
  );
}
