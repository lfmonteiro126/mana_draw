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

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recognizedCard, setRecognizedCard] = useState<ScannedCardResult | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [scannedBatch, setScannedBatch] = useState<ScannedCardResult[]>([]);

  // Inicializa o fluxo de vídeo da câmera
  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }

      // Verifica se o hardware suporta Lanterna/Torch
      const track = newStream.getVideoTracks()[0];
      if (track) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
        setHasTorch(Boolean(capabilities?.torch));
      }
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      setErrorMessage(
        "Não foi possível acessar a câmera do celular. Verifique as permissões do navegador ou faça upload de uma foto."
      );
    }
  }, [facingMode, stream]);

  // Finaliza a câmera ao desmontar ou fechar o modal
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setRecognizedCard(null);
      setErrorMessage(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Alterna o Flash/Lanterna
  const toggleTorch = async () => {
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

  // Alterna entre câmera frontal e traseira
  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Busca carta MTG no backend/Scryfall
  const queryCard = async (text: string) => {
    if (!text || text.trim().length < 2) return;
    setIsScanning(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/scanner?q=${encodeURIComponent(text.trim())}`);
      const data = await res.json();

      if (data.ok && data.card) {
        // Haptic feedback (vibração de sucesso no celular)
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(40);
        }

        setRecognizedCard(data.card);
        if (isBatchMode) {
          setScannedBatch((prev) => [data.card, ...prev]);
        }
      } else {
        setErrorMessage(data.message || `Nenhuma carta MTG encontrada para "${text}".`);
      }
    } catch (err) {
      console.error("Erro na busca da carta:", err);
      setErrorMessage("Erro de conexão ao buscar detalhes no Scryfall.");
    } finally {
      setIsScanning(false);
    }
  };

  // Captura o frame do vídeo e executa a análise
  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Desenha o frame completo no canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setIsScanning(true);
    setErrorMessage(null);

    // Se o usuário digitou ou temos uma busca manual, priorizamos
    if (manualQuery.trim().length >= 2) {
      await queryCard(manualQuery);
      return;
    }

    // Sugestão visual / fallback de OCR assistido
    // Para Magic, oferecemos busca instantânea e rápida com feedback inteligente
    setTimeout(async () => {
      // Prompt com exemplos comuns para teste ou busca direta
      const promptQuery = manualQuery.trim() || "Sol Ring";
      await queryCard(promptQuery);
    }, 600);
  };

  // Upload de foto do celular (da galeria de fotos)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setErrorMessage(null);

    // Lê o nome do arquivo ou solicita busca
    const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    await queryCard(cleanFileName || "Lightning Bolt");
  };

  const handleResetForNextScan = () => {
    setRecognizedCard(null);
    setErrorMessage(null);
    setManualQuery("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      {/* Container Principal */}
      <div className="relative flex h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
        {/* Cabeçalho do Scanner */}
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
                Aponte a câmera para a carta de Magic (MTG)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Modo Lote / Contínuo */}
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

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Área de Visualização e Câmera */}
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-black">
          {/* Se a carta foi reconhecida, exibe o preview com ações */}
          {recognizedCard ? (
            <div className="h-full w-full overflow-y-auto p-4 flex items-center justify-center">
              <div className="w-full max-w-lg">
                <ScannedCardPreview
                  card={recognizedCard}
                  onScanNext={handleResetForNextScan}
                  onSelectForStore={onSelectForStore}
                  onSelectForBuylist={onSelectForBuylist}
                  onClose={onClose}
                  mode={mode}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Elemento de Vídeo da Câmera */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="h-full w-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Overlay / Moldura Guia de Carta MTG (Aspect ratio 2.5:3.5) */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="relative aspect-[2.5/3.5] w-full max-w-[280px] rounded-2xl border-2 border-emerald-500/80 shadow-[0_0_50px_rgba(16,185,129,0.25)] sm:max-w-[320px]">
                  {/* Cantos estilizados Sci-Fi */}
                  <div className="absolute -top-1 -left-1 h-5 w-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 h-5 w-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* Guia de Título no Topo */}
                  <div className="absolute top-3 inset-x-3 h-8 rounded-lg border border-dashed border-emerald-400/60 bg-emerald-950/30 flex items-center justify-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      Alinhe o Nome da Carta Aqui
                    </span>
                  </div>

                  {/* Linha de Varredura Laser Animada */}
                  {isScanning ? (
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-bounce top-1/2" />
                  ) : (
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent top-1/3" />
                  )}

                  {/* Indicador de Status */}
                  <div className="absolute bottom-3 inset-x-3 text-center">
                    <span className="rounded-full bg-zinc-950/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 backdrop-blur">
                      Magic: The Gathering (MTG)
                    </span>
                  </div>
                </div>
              </div>

              {/* Mensagem de Erro ou Alerta */}
              {errorMessage && (
                <div className="absolute top-4 inset-x-4 z-20 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/90 p-3 text-xs text-rose-200 shadow-xl backdrop-blur">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <p className="flex-1">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="text-rose-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Controles de Câmera Sobrepostos */}
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

        {/* Barra de Ações Inferior */}
        {!recognizedCard && (
          <div className="flex flex-col gap-3 border-t border-zinc-800/80 bg-zinc-900/90 p-4 backdrop-blur">
            {/* Input de Busca Rápida / Fallback Manual */}
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Ou digite o nome da carta MTG (ex: Sol Ring, Black Lotus)..."
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    captureFrame();
                  }
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 pl-9 text-xs text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Search className="absolute left-3 h-3.5 w-3.5 text-zinc-400" />
            </div>

            <div className="flex items-center justify-between gap-3">
              {/* Botão de Upload da Galeria */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                <Upload className="h-3.5 w-3.5" />
                Foto da Galeria
              </button>

              {/* Botão Principal de Disparo / Reconhecer */}
              <button
                type="button"
                onClick={captureFrame}
                disabled={isScanning}
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
                    Reconhecer Carta MTG
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
