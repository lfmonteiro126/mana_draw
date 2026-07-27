"use client";

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";

export function BuylistPhotoGallery({
  customerName,
  photos
}: {
  customerName: string;
  photos: string[];
}) {
  const titleId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const open = activeIndex !== null;
  const current = open ? photos[activeIndex] : null;

  const close = useCallback(() => setActiveIndex(null), []);

  const showPrev = useCallback(() => {
    setActiveIndex((index) => {
      if (index === null || photos.length === 0) return index;
      return (index - 1 + photos.length) % photos.length;
    });
  }, [photos.length]);

  const showNext = useCallback(() => {
    setActiveIndex((index) => {
      if (index === null || photos.length === 0) return index;
      return (index + 1) % photos.length;
    });
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") showPrev();
      if (event.key === "ArrowRight") showNext();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open, showNext, showPrev]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {photos.map((url, index) => (
          <button
            key={`${customerName}-thumb-${index}`}
            type="button"
            className="group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] text-left transition hover:border-[var(--accent)] hover:ring-2 hover:ring-[var(--accent)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            onClick={() => setActiveIndex(index)}
            aria-label={`Ampliar foto ${index + 1} de ${photos.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data URLs / blob photos */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/35">
              <Expand
                className="text-white opacity-0 drop-shadow transition group-hover:opacity-100"
                size={22}
              />
            </span>
          </button>
        ))}
      </div>

      {open && current ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={close}
        >
          <div
            className="relative flex max-h-[min(92vh,920px)] w-full max-w-5xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3 text-white">
              <div className="min-w-0">
                <p id={titleId} className="truncate text-sm font-semibold">
                  Fotos · {customerName}
                </p>
                <p className="text-xs text-white/70">
                  {activeIndex! + 1} de {photos.length} · Esc para fechar
                </p>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                onClick={close}
                aria-label="Fechar foto ampliada"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              {photos.length > 1 ? (
                <button
                  type="button"
                  className="absolute left-0 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-2"
                  onClick={showPrev}
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={22} />
                </button>
              ) : null}

              {/* eslint-disable-next-line @next/next/no-img-element -- data URLs / blob photos */}
              <img
                src={current}
                alt={`Foto ${activeIndex! + 1} da buylist de ${customerName}`}
                className="max-h-[min(80vh,860px)] w-auto max-w-full rounded-xl object-contain shadow-2xl"
              />

              {photos.length > 1 ? (
                <button
                  type="button"
                  className="absolute right-0 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-2"
                  onClick={showNext}
                  aria-label="Próxima foto"
                >
                  <ChevronRight size={22} />
                </button>
              ) : null}
            </div>

            {photos.length > 1 ? (
              <div className="mt-4 flex justify-center gap-2 overflow-x-auto pb-1">
                {photos.map((url, index) => (
                  <button
                    key={`${customerName}-dot-${index}`}
                    type="button"
                    className={`h-14 w-11 shrink-0 overflow-hidden rounded-md border transition ${
                      index === activeIndex
                        ? "border-white ring-2 ring-white/70"
                        : "border-white/20 opacity-70 hover:opacity-100"
                    }`}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Ir para foto ${index + 1}`}
                    aria-current={index === activeIndex}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URLs / blob photos */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
