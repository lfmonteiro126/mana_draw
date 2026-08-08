"use client";

import {
  AlertCircle,
  Camera,
  Flashlight,
  FlashlightOff,
  Loader2,
  Search,
  SwitchCamera,
  Upload,
  X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannedCardPreview } from "./scanned-card-preview";
import {
  cropCardTitleFromImage,
  cropCardTitleFromVideo,
  cropGuideFromVideo,
  getGuideRectRelativeToVideo,
  loadImageElement,
  mapElementRectToVideoPixels,
  recognizeCardTitleRobust,
  terminateOcrWorker,
  estimateRegionContrast
} from "@/lib/scanner/ocr";
import type { ScannedCardResult } from "@/lib/scanner/scryfall";

type CardScannerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectForStore?: (card: ScannedCardResult) => void;
  onSelectForBuylist?: (card: ScannedCardResult) => void;
  mode?: "store" | "buylist" | "general";
  title?: string;
};

export function CardScannerModal({
  isOpen,
  onClose,
  onSelectForStore,
  onSelectForBuylist,
  mode = "general",
  title = "Scanner de Cartas MTG"
}: CardScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleGuideRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recognizedCard, setRecognizedCard] = useState<ScannedCardResult | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [scannedBatch, setScannedBatch] = useState<ScannedCardResult[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setHasTorch(false);
    setIsTorchOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    setCameraReady(false);
    setCameraFailed(false);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraFailed(true);
      setErrorMessage(
        "Este navegador não suporta câmera. Use o upload de foto ou digite o nome da carta."
      );
      return;
    }

    stopCamera();

    const attempts: MediaStreamConstraints[] = [
      {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      },
      {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      {
        audio: false,
        video: {
          facingMode: facingMode
        }
      },
      {
        audio: false,
        video: true
      }
    ];

    let lastError: unknown = null;
    for (const constraints of attempts) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = newStream;

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          // iOS Safari: playsInline + muted required before play()
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.muted = true;
          await videoRef.current.play();
        }

        const track = newStream.getVideoTracks()[0];
        if (track) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
          setHasTorch(Boolean(capabilities?.torch));
        }

        setCameraReady(true);
        return;
      } catch (err) {
        lastError = err;
      }
    }

    console.error("Erro ao acessar câmera:", lastError);
    setCameraFailed(true);
    setErrorMessage(
      "Não foi possível acessar a câmera do celular. Verifique as permissões do navegador ou faça upload de uma foto."
    );
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setRecognizedCard(null);
      setErrorMessage(null);
      setStatusMessage(null);
      setIsScanning(false);
      setCameraFailed(false);
      void terminateOcrWorker();
      return;
    }

    void startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  const toggleTorch = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !isTorchOn;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      console.warn("Torch não suportado:", e);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const queryCard = async (text: string) => {
    if (!text || text.trim().length < 2) return false;

    setStatusMessage(`Buscando “${text.trim()}” no Scryfall…`);

    try {
      const res = await fetch(`/api/scanner?q=${encodeURIComponent(text.trim())}`);
      const data = await res.json();

      if (data.ok && data.card) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(40);
        }

        setRecognizedCard(data.card);
        setStatusMessage(null);
        if (isBatchMode) {
          setScannedBatch((prev) => [data.card, ...prev]);
        }
        return true;
      }

      setErrorMessage(
        data.message ||
          `Nenhuma carta MTG encontrada para "${text}". Ajuste o enquadramento ou corrija o nome e busque.`
      );
      setStatusMessage(null);
      return false;
    } catch (err) {
      console.error("Erro na busca da carta:", err);
      setErrorMessage("Erro de conexão ao buscar detalhes no Scryfall.");
      setStatusMessage(null);
      return false;
    }
  };

  /** Manual search only — never used by the camera shutter. */
  const searchManual = async () => {
    if (isScanning) return;
    const q = manualQuery.trim();
    if (q.length < 2) {
      setErrorMessage("Digite pelo menos 2 letras do nome da carta.");
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    try {
      await queryCard(q);
    } finally {
      setIsScanning(false);
    }
  };

  const buildTitleCanvasFromCamera = ():
    | { ok: true; canvas: HTMLCanvasElement }
    | { ok: false; message: string } => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return { ok: false, message: "Não foi possível capturar o frame da câmera." };
    }

    if (titleGuideRef.current) {
      // Pre-check contrast on the mapped guide region (raw pixels, pre-binarization).
      const relative = getGuideRectRelativeToVideo(video, titleGuideRef.current);
      const source = mapElementRectToVideoPixels(video, {
        x: relative.x - relative.width * 0.08,
        y: relative.y - relative.height * 0.04,
        width: relative.width * 1.16,
        height: relative.height * 1.2
      });
      if (source) {
        const contrast = estimateRegionContrast(
          video,
          source.x,
          source.y,
          source.width,
          source.height
        );
        if (contrast < 180) {
          return {
            ok: false,
            message:
              "Imagem sem contraste suficiente no nome. Enquadre a carta com boa luz e foque o título na moldura tracejada."
          };
        }
      }

      const cropped = cropGuideFromVideo(video, canvas, titleGuideRef.current, {
        padRatio: 0.1,
        scale: 3.5
      });
      if (!cropped) {
        return { ok: false, message: "Não foi possível capturar o frame da câmera." };
      }
      return { ok: true, canvas: cropped };
    }

    const fallback = cropCardTitleFromVideo(video, canvas);
    if (!fallback) {
      return { ok: false, message: "Não foi possível capturar o frame da câmera." };
    }
    return { ok: true, canvas: fallback };
  };

  /** Camera shutter — always OCR the live frame (ignores leftover manual text). */
  const captureFrame = async () => {
    if (isScanning) return;

    setIsScanning(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const video = videoRef.current;
      if (!video || !cameraReady || !video.videoWidth) {
        setErrorMessage("Aguarde a câmera carregar ou digite o nome da carta.");
        return;
      }

      setStatusMessage("Lendo o nome da carta (OCR)…");
      const built = buildTitleCanvasFromCamera();
      if (!built.ok) {
        setErrorMessage(built.message);
        setStatusMessage(null);
        return;
      }

      const ocr = await recognizeCardTitleRobust(built.canvas);
      if (!ocr) {
        setErrorMessage(
          "Não consegui ler o nome com confiança. Enquadre só o título na área tracejada, melhore a luz e tente de novo — ou digite o nome."
        );
        setStatusMessage(null);
        return;
      }

      // Suggest the reading in the field so the user can correct it if Scryfall misses.
      setManualQuery(ocr.text);
      setStatusMessage(`Li “${ocr.text}” (${Math.round(ocr.confidence)}%) — buscando…`);
      const found = await queryCard(ocr.text);
      if (!found) {
        setErrorMessage(
          `Li “${ocr.text}”, mas não achei no Scryfall. Corrija o nome abaixo e toque em Buscar, ou escaneie de novo.`
        );
      }
    } catch (err) {
      console.error("Erro no reconhecimento:", err);
      setErrorMessage("Falha ao reconhecer a carta. Tente de novo ou digite o nome.");
      setStatusMessage(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || isScanning) return;

    setIsScanning(true);
    setErrorMessage(null);
    setStatusMessage("Lendo foto da galeria (OCR)…");

    try {
      const image = await loadImageElement(file);
      const canvas = canvasRef.current ?? document.createElement("canvas");
      cropCardTitleFromImage(image, canvas);
      let ocr = await recognizeCardTitleRobust(canvas);

      if (!ocr) {
        ocr = await recognizeCardTitleRobust(image);
      }

      if (!ocr) {
        setErrorMessage(
          "Não consegui ler o nome na foto. Tente outra imagem com o título bem visível ou digite o nome."
        );
        setStatusMessage(null);
        return;
      }

      setManualQuery(ocr.text);
      await queryCard(ocr.text);
    } catch (err) {
      console.error("Erro no upload/OCR:", err);
      setErrorMessage("Falha ao processar a foto. Tente novamente.");
      setStatusMessage(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleResetForNextScan = () => {
    setRecognizedCard(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setManualQuery("");
  };

  const handleClose = () => {
    stopCamera();
    void terminateOcrWorker();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Camera className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">
                {title}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Enquadre o nome da carta na área tracejada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBatchMode(!isBatchMode)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                isBatchMode
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
              title="Escanear múltiplas cartas em sequência"
            >
              Lote {scannedBatch.length > 0 && `(${scannedBatch.length})`}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-black">
          {recognizedCard ? (
            <div className="h-full w-full overflow-y-auto p-4 flex items-center justify-center">
              <div className="w-full max-w-lg">
                <ScannedCardPreview
                  card={recognizedCard}
                  onScanNext={handleResetForNextScan}
                  onSelectForStore={onSelectForStore}
                  onSelectForBuylist={onSelectForBuylist}
                  onClose={handleClose}
                  mode={mode}
                />
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="h-full w-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="relative aspect-[2.5/3.5] w-full max-w-[280px] rounded-2xl border-2 border-emerald-500/80 shadow-[0_0_50px_rgba(16,185,129,0.25)] sm:max-w-[320px]">
                  <div className="absolute -top-1 -left-1 h-5 w-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 h-5 w-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* Title guide — OCR crops this exact on-screen box (object-cover aware). */}
                  <div
                    ref={titleGuideRef}
                    className="absolute top-[4%] inset-x-[7%] h-[11%] rounded-lg border border-dashed border-emerald-400/70 bg-emerald-950/20 flex items-center justify-center"
                  >
                    {!isScanning && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
                        Nome da carta aqui
                      </span>
                    )}
                  </div>

                  {isScanning ? (
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-bounce top-1/2" />
                  ) : null}

                  <div className="absolute bottom-3 inset-x-3 text-center">
                    <span className="rounded-full bg-zinc-950/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 backdrop-blur">
                      {cameraReady
                        ? "Magic: The Gathering (MTG)"
                        : cameraFailed
                          ? "Câmera indisponível — use foto ou busca"
                          : "Iniciando câmera…"}
                    </span>
                  </div>
                </div>
              </div>

              {(errorMessage || statusMessage) && (
                <div
                  className={`absolute top-4 inset-x-4 z-20 flex items-center gap-2 rounded-xl border p-3 text-xs shadow-xl backdrop-blur ${
                    errorMessage
                      ? "border-rose-500/40 bg-rose-950/90 text-rose-200"
                      : "border-emerald-500/40 bg-emerald-950/90 text-emerald-100"
                  }`}
                >
                  {errorMessage ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  ) : (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-300" />
                  )}
                  <p className="flex-1">{errorMessage || statusMessage}</p>
                  {errorMessage && (
                    <button
                      type="button"
                      onClick={() => setErrorMessage(null)}
                      className="text-rose-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition shadow-lg ${
                      isTorchOn
                        ? "bg-amber-500 text-zinc-950 font-bold"
                        : "bg-zinc-900/80 text-white hover:bg-zinc-800"
                    }`}
                    title={isTorchOn ? "Desligar lanterna" : "Ligar lanterna"}
                  >
                    {isTorchOn ? (
                      <Flashlight className="h-4 w-4" />
                    ) : (
                      <FlashlightOff className="h-4 w-4" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleCamera}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/80 text-white backdrop-blur hover:bg-zinc-800 transition shadow-lg"
                  title="Alternar câmera frontal/traseira"
                >
                  <SwitchCamera className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {!recognizedCard && (
          <div className="flex flex-col gap-3 border-t border-zinc-800/80 bg-zinc-900/90 p-4 backdrop-blur">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ou digite/corrija o nome e toque em Buscar…"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void searchManual();
                    }
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              </div>
              <button
                type="button"
                onClick={() => void searchManual()}
                disabled={isScanning || manualQuery.trim().length < 2}
                className="shrink-0 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
              >
                Buscar
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Foto
              </button>

              <button
                type="button"
                onClick={() => void captureFrame()}
                disabled={isScanning || (!cameraReady && !cameraFailed)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 active:scale-[0.98] transition disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reconhecendo...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Escanear pela Câmera
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
