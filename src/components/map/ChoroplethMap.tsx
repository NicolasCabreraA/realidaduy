"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import StateView from "@/components/ui/StateView";

export interface MapEntry {
  fill: string;
  label: string;
  sublabel?: string;
}

type Props = {
  geoUrl: string;
  /**
   * Capa de contexto no interactiva que se dibuja debajo (p. ej. los límites
   * departamentales bajo el mapa de municipios, que no cubren todo el país).
   */
  backdropUrl?: string;
  entries: Record<string, MapEntry>;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Mostrar código corto en el centroide (solo pantallas medianas+). */
  showCodes?: boolean;
  title: string;
};

const WIDTH = 720;

// Navegadores sin :focus-visible tiran error al consultarlo: ahí se marca siempre.
function isFocusVisible(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

export default function ChoroplethMap({
  geoUrl,
  backdropUrl,
  entries,
  selectedId = null,
  onSelect,
  showCodes = true,
  title,
}: Props) {
  const [fc, setFc] = useState<FeatureCollection | null>(null);
  const [backdropFc, setBackdropFc] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: string } | null>(null);
  // Territorio con foco de teclado: se marca con un contorno de dos tonos
  // (blanco y ámbar) dibujado encima, visible sobre cualquier relleno.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const afterMapId = useId();

  // El cartel se cierra con Escape sin mover el mouse ni el foco (WCAG 1.4.13).
  useEffect(() => {
    if (!tooltip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTooltip(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tooltip]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    const load = (url: string) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<FeatureCollection>;
      });
    Promise.all([load(geoUrl), backdropUrl ? load(backdropUrl) : Promise.resolve(null)])
      .then(([data, backdrop]) => {
        if (cancelled) return;
        setFc(data);
        setBackdropFc(backdrop);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [geoUrl, backdropUrl]);

  const layout = useMemo(() => {
    if (!fc) return null;
    if (backdropUrl && !backdropFc) return null;
    // La proyección se ajusta a la capa de mayor extensión (el fondo cubre
    // todo el país; los municipios, no).
    const extentFc = backdropFc ?? fc;
    const projection = geoMercator().fitWidth(WIDTH - 16, extentFc);
    const path = geoPath(projection);
    const bounds = path.bounds(extentFc);
    const height = Math.ceil(bounds[1][1]) + 8;
    const features = fc.features
      .filter((f): f is Feature<Geometry> & { properties: { territoryId: string; name: string } } =>
        Boolean(f.properties && (f.properties as { territoryId?: string }).territoryId)
      )
      .map((f) => ({
        id: (f.properties as { territoryId: string }).territoryId,
        name: (f.properties as { name: string }).name,
        d: path(f) ?? "",
        centroid: path.centroid(f),
      }));
    const backdropPaths = (backdropFc?.features ?? []).map((f) => path(f) ?? "");
    return { height, features, backdropPaths };
  }, [fc, backdropFc, backdropUrl]);

  if (error) {
    return <StateView kind="error" detail="No se pudo cargar el mapa." />;
  }
  if (!layout) {
    return (
      <div
        role="status"
        aria-label="Cargando mapa"
        className="aspect-square w-full animate-pulse rounded-2xl bg-primary-soft"
      />
    );
  }

  // El cartel se ancla al centro del territorio (no sigue al puntero), así se
  // puede pasar el mouse por encima sin que desaparezca (WCAG 1.4.13).
  const showTooltip = (f: { id: string; centroid: [number, number] }) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = rect.width / WIDTH;
    setTooltip({ x: f.centroid[0] * scale, y: f.centroid[1] * scale, id: f.id });
  };
  const hideTooltipSoon = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTooltip(null), 200);
  };
  const keepTooltip = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  const ordered = [...layout.features].sort((a, b) =>
    a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0
  );

  const outlined = layout.features.filter((f) => f.id === selectedId || f.id === focusedId);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Con teclado, cada territorio es una parada de Tab (136 en el mapa de
          municipios): este enlace permite saltear el mapa entero. */}
      <a
        href={`#${afterMapId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-20 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary focus:shadow-overlay"
      >
        Saltar el mapa
      </a>
      <svg
        viewBox={`0 0 ${WIDTH} ${layout.height}`}
        role="group"
        aria-label={title}
        className="h-auto w-full"
      >
        {layout.backdropPaths.map((d, i) => (
          <path
            key={`bg-${i}`}
            d={d}
            fill="var(--color-surface)"
            stroke="var(--color-line)"
            strokeWidth={1}
            strokeLinejoin="round"
            aria-hidden
            className="pointer-events-none"
          />
        ))}
        {ordered.map((f) => {
          const entry = entries[f.id];
          const selected = f.id === selectedId;
          const aria = entry
            ? `${entry.label}${entry.sublabel ? `, ${entry.sublabel}` : ""}`
            : f.name;
          return (
            <path
              key={f.id}
              d={f.d}
              fill={entry?.fill ?? "var(--color-line)"}
              stroke="var(--color-surface)"
              strokeWidth={1}
              strokeLinejoin="round"
              tabIndex={0}
              role="button"
              aria-label={aria}
              aria-pressed={onSelect ? selected : undefined}
              className="cursor-pointer transition-[fill-opacity] hover:fill-opacity-80 focus:outline-none"
              onClick={() => onSelect?.(selected ? null : f.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(selected ? null : f.id);
                }
              }}
              onMouseEnter={() => showTooltip(f)}
              onMouseLeave={hideTooltipSoon}
              onFocus={(e) => {
                showTooltip(f);
                if (isFocusVisible(e.currentTarget)) setFocusedId(f.id);
              }}
              onBlur={() => {
                setTooltip(null);
                setFocusedId(null);
              }}
            />
          );
        })}
        {/* Contornos de selección y de foco, encima de todo para que ningún
            vecino los tape: blanco debajo y color arriba, se ven sobre
            rellenos claros y oscuros (WCAG 1.4.11 y 2.4.7). */}
        {outlined.map((f) => (
          <g key={`outline-${f.id}`} aria-hidden className="pointer-events-none">
            <path d={f.d} fill="none" stroke="var(--color-surface)" strokeWidth={5} strokeLinejoin="round" />
            <path
              d={f.d}
              fill="none"
              stroke={f.id === focusedId ? "var(--color-focus)" : "var(--color-ink)"}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          </g>
        ))}
        {showCodes
          ? layout.features.map((f) => (
              <text
                key={`label-${f.id}`}
                x={f.centroid[0]}
                y={f.centroid[1]}
                textAnchor="middle"
                className="pointer-events-none hidden select-none md:block"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fill: "var(--color-ink)",
                  stroke: "var(--color-surface)",
                  strokeWidth: 3,
                  paintOrder: "stroke",
                }}
                aria-hidden
              >
                {f.id.split("-").pop()}
              </text>
            ))
          : null}
      </svg>
      <span id={afterMapId} tabIndex={-1} className="sr-only">
        Fin del mapa
      </span>
      {tooltip && entries[tooltip.id] ? (
        <div
          className="absolute z-10 max-w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-overlay"
          style={{ left: tooltip.x, top: tooltip.y }}
          role="tooltip"
          onMouseEnter={keepTooltip}
          onMouseLeave={hideTooltipSoon}
        >
          <p className="font-bold text-ink">{entries[tooltip.id].label}</p>
          {entries[tooltip.id].sublabel ? (
            <p className="tnum text-ink-soft">{entries[tooltip.id].sublabel}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
