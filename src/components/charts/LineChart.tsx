"use client";

import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatValue } from "@/lib/format";

export interface LinePoint {
  x: string;
  y: number;
}

export default function LineChart({
  data,
  unit,
  decimals,
}: {
  data: LinePoint[];
  unit: string;
  decimals: number;
}) {
  const gradientId = useId().replace(/[:]/g, "");
  const last = data[data.length - 1];
  // El cartel del puntero se cierra con Escape (WCAG 1.4.13) y vuelve al
  // mover el mouse. Los mismos datos están en la tabla "Ver datos".
  const [tipHidden, setTipHidden] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTipHidden(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div
      aria-hidden
      className="h-64 w-full md:h-72"
      onMouseMove={() => {
        if (tipHidden) setTipHidden(false);
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fill: "var(--color-ink-faint)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-line)" }}
            minTickGap={32}
          />
          <YAxis
            width={52}
            tick={{ fill: "var(--color-ink-faint)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              unit === "%" ? `${formatNumber(v, 0)}%` : formatNumber(v, 0)
            }
          />
          <Tooltip
            active={tipHidden ? false : undefined}
            cursor={{ stroke: "var(--color-ink-faint)", strokeDasharray: "3 3" }}
            formatter={(value) => [formatValue(Number(value), unit, decimals), ""]}
            separator=""
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--color-line)",
              boxShadow: "var(--shadow-card)",
              fontSize: 13,
              fontFamily: "var(--font-body)",
            }}
          />
          <Area
            type="monotone"
            dataKey="y"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)" }}
          />
          {last ? (
            <ReferenceDot
              x={last.x}
              y={last.y}
              r={4}
              fill="var(--chart-1)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
