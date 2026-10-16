"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { motion, useReducedMotion } from "motion/react";

/*
 * Firma visual del sitio: el país dibujado con su propia cartografía.
 * Los 19 departamentos aparecen uno a uno al cargar; al tocar uno se
 * abre el mapa interactivo. Con prefers-reduced-motion se muestra estático.
 * Es un atajo para el mouse y el dedo: para el teclado y los lectores de
 * pantalla queda fuera, porque los 19 departamentos llevaban al mismo lugar
 * que el botón "Explorá el mapa" que está al lado (19 paradas de Tab de más).
 */

const WIDTH = 520;

type Props = { className?: string };

export default function HeroMap({ className }: Props) {
  const [fc, setFc] = useState<FeatureCollection | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/departamentos.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FeatureCollection | null) => {
        if (!cancelled && data) setFc(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const layout = useMemo(() => {
    if (!fc) return null;
    const projection = geoMercator().fitWidth(WIDTH - 8, fc);
    const path = geoPath(projection);
    const bounds = path.bounds(fc);
    const height = Math.ceil(bounds[1][1]) + 4;
    const features = fc.features
      .filter((f): f is Feature<Geometry> & { properties: { territoryId: string; name: string } } =>
        Boolean(f.properties && (f.properties as { territoryId?: string }).territoryId)
      )
      .map((f) => ({
        id: (f.properties as { territoryId: string }).territoryId,
        name: (f.properties as { name: string }).name,
        d: path(f) ?? "",
      }));
    return { height, features };
  }, [fc]);

  if (!layout) {
    return (
      <div
        aria-hidden
        className={`aspect-square w-full animate-pulse rounded-2xl bg-white/5 ${className ?? ""}`}
      />
    );
  }

  const hoveredName = layout.features.find((f) => f.id === hovered)?.name;

  return (
    <div className={`relative ${className ?? ""}`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${layout.height}`}
        aria-hidden
        className="h-auto w-full drop-shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
      >
        {layout.features.map((f, i) => (
          <motion.path
            key={f.id}
            d={f.d}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.15 + i * 0.045 }}
            fill={hovered === f.id ? "var(--color-celeste)" : "var(--color-celeste-soft)"}
            fillOpacity={hovered === f.id ? 0.95 : 0.82}
            stroke="var(--color-primary)"
            strokeWidth={0.8}
            strokeLinejoin="round"
            className="cursor-pointer transition-[fill,fill-opacity] duration-150"
            onClick={() => router.push("/mapa")}
            onMouseEnter={() => setHovered(f.id)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {/* Debajo del mapa y no encima: sobre el relleno claro de la costa el
          texto blanco quedaba sin contraste. */}
      <p
        aria-hidden
        className="pointer-events-none mt-2 text-center text-sm font-semibold text-white/80"
      >
        {hoveredName ?? "19 departamentos · tocá para explorar"}
      </p>
    </div>
  );
}
