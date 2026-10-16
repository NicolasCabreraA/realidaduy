"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Contenedor de tabla con desplazamiento horizontal (clase .tablewrap). Cuando
 * la tabla no entra y se desliza, el contenedor pasa a ser una parada de Tab
 * con nombre, para poder desplazarlo con las flechas del teclado (WCAG 2.1.1).
 * Si la tabla entra, no agrega paradas de Tab.
 */
export default function TableWrap({
  label,
  className,
  children,
}: {
  /** Nombre de la región para lectores de pantalla ("Resultados por departamento"). */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className ? `tablewrap ${className}` : "tablewrap"}
      {...(scrolls ? { role: "region", "aria-label": label, tabIndex: 0 } : {})}
    >
      {children}
    </div>
  );
}
