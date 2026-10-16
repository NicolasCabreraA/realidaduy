"use client";

import { motion, type MotionStyle } from "motion/react";
import { formatNumber } from "@/lib/format";

export interface PartyBarRow {
  name: string;
  color: string;
  pct: number;
  votes?: number | null;
}

/**
 * Barras horizontales de resultados electorales: color partidario como
 * codificación de categoría, siempre con etiqueta de texto y porcentaje.
 * Crecen una única vez al entrar en pantalla. Con reduced-motion se ven con su
 * ancho final desde el principio: lo resuelve globals.css ([data-bar] y
 * --bar-w), porque el servidor manda width 0 en línea y la hidratación no lo
 * corregía si el cliente cambiaba de elemento.
 */
export default function PartyBars({
  rows,
  compact = false,
}: {
  rows: PartyBarRow[];
  compact?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.pct), 1);
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {rows.map((r, i) => {
        const widthPct = `${Math.max((r.pct / max) * 100, 1.5)}%`;
        return (
          <div
            key={r.name}
            className={`grid items-center gap-2 text-sm ${
              compact
                ? "grid-cols-[8.5rem_1fr_auto]"
                : "grid-cols-[10rem_1fr_auto] sm:grid-cols-[13rem_1fr_auto]"
            }`}
          >
            {/* Sin truncar: con zoom o más espaciado de texto el nombre baja de
                línea en vez de cortarse (WCAG 1.4.10 y 1.4.12). */}
            <span className="min-w-0 break-words font-semibold leading-tight">{r.name}</span>
            <span aria-hidden className="h-5 overflow-hidden rounded-r-sm bg-canvas">
              <motion.span
                data-bar
                className="block h-full rounded-r-sm border-y border-r border-ink/10"
                // --bar-w: ancho final para reduced-motion (MotionStyle no tipa variables CSS).
                style={{ background: r.color, "--bar-w": widthPct } as MotionStyle}
                initial={{ width: 0 }}
                whileInView={{ width: widthPct }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.7, delay: i * 0.045, ease: [0.23, 1, 0.32, 1] }}
              />
            </span>
            <span className="tnum font-bold">{formatNumber(r.pct, 2)}%</span>
          </div>
        );
      })}
    </div>
  );
}
