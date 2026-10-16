import { useId } from "react";

/**
 * Serie histórica en miniatura (SVG puro, renderizado en servidor).
 * Decorativa: el dato accesible es el valor de la tarjeta; aria-hidden.
 */
export default function Sparkline({
  values,
  width = 120,
  height = 34,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const gradientId = useId().replace(/[:]/g, "");
  if (values.length < 4) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const step = (width - pad * 2) / (values.length - 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span);
  const points = values.map((v, i) => [pad + i * step, y(v)] as const);
  const line = points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${(pad + (values.length - 1) * step).toFixed(1)},${height - pad}`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
      // max-w-full: en pantallas de 320 px la tarjeta es más angosta que el
      // ancho nominal y el gráfico desbordaba la página (WCAG 1.4.10).
      className="h-auto max-w-full overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-celeste)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-celeste)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-celeste-deep)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth="1.5" />
    </svg>
  );
}
