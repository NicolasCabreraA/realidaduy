"use client";

import { useEffect, useRef, useState } from "react";
import {
  canCopyImage,
  canShareImage,
  captureCard,
  copyImage,
  downloadImage,
  shareImage,
  type CapturedImage,
} from "@/lib/share-image";

type Phase = "idle" | "working" | "ready" | "error";

/**
 * Botón "Imagen": captura la tarjeta contenedora ([data-share-card]) como PNG
 * con título, fuente y marca, y ofrece descargarla, copiarla o compartirla.
 * Debe renderizarse dentro de la tarjeta, envuelto en [data-no-export].
 */
export default function ShareButton({
  filename,
  title,
}: {
  /** Nombre del archivo sin extensión (kebab-case). */
  filename: string;
  /** Título para la hoja de compartir del sistema. */
  title: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [image, setImage] = useState<CapturedImage | null>(null);
  const [copied, setCopied] = useState(false);
  const [tvPhase, setTvPhase] = useState<"idle" | "working" | "error">("idle");
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const open = phase === "ready" && image !== null;

  // Cerrar con Escape o clic fuera del popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPhase("idle");
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPhase("idle");
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => {
    if (phase !== "error") return;
    const t = setTimeout(() => setPhase("idle"), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  const runRef = useRef(0);

  const generate = async () => {
    if (phase === "working") return;
    if (open) {
      setPhase("idle");
      return;
    }
    const card = wrapRef.current?.closest<HTMLElement>("[data-share-card]");
    if (!card) {
      setPhase("error");
      return;
    }
    const run = ++runRef.current;
    setPhase("working");
    setCopied(false);
    try {
      const captured = await Promise.race([
        captureCard(card),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 20000)
        ),
      ]);
      if (runRef.current !== run) return;
      setImage(captured);
      setPhase("ready");
    } catch {
      if (runRef.current === run) setPhase("error");
    }
  };

  // Placa 16:9 para informativos: se genera aparte porque es otra composición
  // (la tarjeta centrada sobre fondo de marca a 1920×1080).
  const onTvPlate = async () => {
    if (tvPhase === "working") return;
    const card = wrapRef.current?.closest<HTMLElement>("[data-share-card]");
    if (!card) {
      setTvPhase("error");
      return;
    }
    setTvPhase("working");
    try {
      const plate = await captureCard(card, { format: "tv" });
      downloadImage(plate, `${filename}-1920x1080`);
      setTvPhase("idle");
    } catch {
      setTvPhase("error");
      setTimeout(() => setTvPhase("idle"), 2500);
    }
  };

  const onCopy = async () => {
    if (!image) return;
    if (await copyImage(image)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Avisos para lectores de pantalla (WCAG 4.1.3): los cambios de texto en los
  // botones no siempre se anuncian.
  const status =
    phase === "working"
      ? "Generando la imagen…"
      : phase === "error"
        ? "No se pudo generar la imagen."
        : tvPhase === "working"
          ? "Generando la placa…"
          : tvPhase === "error"
            ? "No se pudo generar la placa."
            : copied
              ? "Imagen copiada al portapapeles."
              : "";

  const actionClass =
    "pressable w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors";

  return (
    <div ref={wrapRef} data-no-export className="relative inline-block">
      <p role="status" className="sr-only">
        {status}
      </p>
      <button
        ref={triggerRef}
        type="button"
        onClick={generate}
        disabled={phase === "working"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="pressable inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-celeste hover:text-primary disabled:opacity-60"
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
          <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" />
          <circle cx="5.6" cy="5.6" r="1.3" fill="currentColor" stroke="none" />
          <path d="M14.5 10.5 11 7l-6.5 6.5" />
        </svg>
        {phase === "working"
          ? "Generando…"
          : phase === "error"
            ? "No se pudo"
            : "Imagen"}
        <span className="sr-only"> para compartir</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Compartir este gráfico como imagen"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 origin-top-right rounded-xl border border-line bg-surface p-3 shadow-overlay transition-[opacity,transform] duration-150 ease-[var(--ease-out-strong)] starting:scale-[0.96] starting:opacity-0"
        >
          {/* La vista previa es un data:URL generado localmente, no un asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.dataUrl}
            alt={`Vista previa de la imagen generada: ${title}`}
            className="max-h-44 w-full rounded-lg border border-line bg-canvas object-contain"
          />
          <div className="mt-2.5 space-y-1.5">
            <button
              type="button"
              autoFocus
              onClick={() => downloadImage(image, filename)}
              className={`${actionClass} bg-primary text-white hover:bg-primary-hover`}
            >
              Descargar PNG
            </button>
            <button
              type="button"
              onClick={onTvPlate}
              disabled={tvPhase === "working"}
              className={`${actionClass} border border-line text-ink-soft hover:border-celeste hover:text-primary disabled:opacity-60`}
            >
              {tvPhase === "working"
                ? "Generando placa…"
                : tvPhase === "error"
                  ? "No se pudo"
                  : "Placa TV 16:9 (1920×1080)"}
            </button>
            {canCopyImage() ? (
              <button
                type="button"
                onClick={onCopy}
                className={`${actionClass} border border-line text-ink-soft hover:border-celeste hover:text-primary`}
              >
                {copied ? "Copiada ✓" : "Copiar al portapapeles"}
              </button>
            ) : null}
            {canShareImage(image, filename) ? (
              <button
                type="button"
                onClick={() => shareImage(image, filename, `${title} · realidad.uy`)}
                className={`${actionClass} border border-line text-ink-soft hover:border-celeste hover:text-primary`}
              >
                Compartir…
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            La imagen incluye el título, la fuente y el período del dato.
          </p>
        </div>
      ) : null}
    </div>
  );
}
