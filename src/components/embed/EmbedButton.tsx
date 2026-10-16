"use client";

import { useEffect, useRef, useState } from "react";
import { SITE_URL } from "@/lib/site";

export interface EmbedOption {
  label: string;
  /** Ruta de la pieza: "/embed/mapa/desempleo". */
  path: string;
  height: number;
}

function snippetFor(option: EmbedOption, title: string): string {
  return [
    `<iframe src="${SITE_URL}${option.path}"`,
    ` title="${title} — ${option.label.toLowerCase()} de realidad.uy"`,
    ` width="100%" height="${option.height}" loading="lazy"`,
    ` style="border:1px solid #e0e5e9;border-radius:12px;max-width:100%"></iframe>`,
  ].join("\n");
}

/**
 * "Insertar": entrega el código de iframe para publicar el mapa o el ranking
 * dentro de una nota. El medio se queda con la pieza viva (se actualiza sola
 * cuando se actualiza el dato) y con la atribución adentro.
 */
export default function EmbedButton({
  options,
  title,
}: {
  options: EmbedOption[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const option = options[active];
  const snippet = snippetFor(option, title);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div ref={wrapRef} data-no-export className="relative inline-block">
      <p role="status" className="sr-only">
        {copied ? "Código copiado al portapapeles." : ""}
      </p>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="pressable inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-celeste hover:text-primary"
      >
        <svg
          aria-hidden
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5.8 11.5 2.3 8l3.5-3.5" />
          <path d="M10.2 4.5 13.7 8l-3.5 3.5" />
        </svg>
        Insertar
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Código para insertar en un sitio"
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(92vw,26rem)] rounded-xl border border-line bg-surface p-3 shadow-overlay"
        >
          {options.length > 1 ? (
            <div role="group" aria-label="Qué insertar" className="flex gap-1">
              {options.map((o, i) => (
                <button
                  key={o.path}
                  type="button"
                  aria-pressed={i === active}
                  onClick={() => setActive(i)}
                  className={`pressable rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    i === active
                      ? "bg-primary text-white"
                      : "border border-line text-ink-soft hover:text-primary"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : null}

          <label className="mt-2.5 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Código
            <textarea
              readOnly
              value={snippet}
              rows={4}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 w-full resize-none rounded-lg border border-control-line bg-canvas p-2 font-mono text-[11px] normal-case tracking-normal text-ink"
            />
          </label>

          <button
            type="button"
            onClick={copy}
            className="pressable mt-2 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {copied ? "Copiado ✓" : "Copiar código"}
          </button>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            El gráfico se actualiza solo cuando se actualiza el dato, y lleva la fuente y la
            atribución adentro. Uso libre.
          </p>
        </div>
      ) : null}
    </div>
  );
}
