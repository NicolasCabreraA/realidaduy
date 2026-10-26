import type { MetadataRoute } from "next";
import { activeIndicators, dictionary } from "@/data/dictionary";
import { departments } from "@/data/territories";
import { absoluteUrl } from "@/lib/site";

// La fecha sale del dato más reciente del diccionario, no del reloj: dos builds
// del mismo commit tienen que producir el mismo sitemap.
const lastUpdated = new Date(
  dictionary.reduce((max, i) => (i.lastUpdated > max ? i.lastUpdated : max), "2026-01-01")
);

const staticRoutes: Array<[string, number]> = [
  ["/", 1],
  ["/mapa", 0.9],
  ["/indicadores", 0.9],
  ["/departamentos", 0.9],
  ["/elecciones", 0.9],
  ["/municipios", 0.8],
  ["/mapa/municipios", 0.8],
  ["/comparar", 0.8],
  ["/datos", 0.8],
  ["/fuentes", 0.7],
  ["/montevideo/municipios", 0.6],
  ["/mas", 0.4],
  ["/terminos", 0.2],
  ["/privacidad", 0.2],
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...staticRoutes.map(([path, priority]) => ({
      url: absoluteUrl(path),
      lastModified: lastUpdated,
      changeFrequency: "monthly" as const,
      priority,
    })),
    ...activeIndicators.map((i) => ({
      url: absoluteUrl(`/indicadores/${i.slug}`),
      lastModified: new Date(i.lastUpdated),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...departments.map((d) => ({
      url: absoluteUrl(`/departamentos/${d.slug}`),
      lastModified: lastUpdated,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...departments.map((d) => ({
      url: absoluteUrl(`/departamentos/${d.slug}/educacion`),
      lastModified: lastUpdated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
