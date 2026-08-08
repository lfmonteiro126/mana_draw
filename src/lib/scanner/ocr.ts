import { cleanOcrText } from "@/lib/scanner/scryfall";

type OcrWorker = {
  recognize: (
    image: string | HTMLCanvasElement | HTMLImageElement | Blob
  ) => Promise<{ data: { text: string; confidence: number } }>;
  setParameters: (params: Record<string, string>) => Promise<void>;
  terminate: () => Promise<void>;
};

let workerPromise: Promise<OcrWorker> | null = null;

async function getOcrWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = (await createWorker("eng")) as unknown as OcrWorker;
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }

  return workerPromise;
}

export async function terminateOcrWorker() {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch {
    // ignore terminate errors
  } finally {
    workerPromise = null;
  }
}

/**
 * Crops the title band of a centered MTG card guide from a video frame.
 * Guide matches the modal overlay: centered, aspect 2.5:3.5, ~72% of frame height.
 */
export function cropCardTitleFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const cardHeight = vh * 0.72;
  const cardWidth = Math.min(vw * 0.9, cardHeight * (2.5 / 3.5));
  const cardX = (vw - cardWidth) / 2;
  const cardY = (vh - cardHeight) / 2;

  const padX = cardWidth * 0.07;
  const titleX = cardX + padX;
  const titleY = cardY + cardHeight * 0.035;
  const titleW = cardWidth - padX * 2;
  const titleH = cardHeight * 0.11;

  return drawRegionUpscaled(video, canvas, titleX, titleY, titleW, titleH, 3);
}

/**
 * Crops title band from an uploaded still image (assumes the card fills most of the frame).
 */
export function cropCardTitleFromImage(
  image: HTMLImageElement | HTMLCanvasElement,
  canvas: HTMLCanvasElement
): HTMLCanvasElement {
  const width =
    image instanceof HTMLImageElement ? image.naturalWidth || image.width : image.width;
  const height =
    image instanceof HTMLImageElement ? image.naturalHeight || image.height : image.height;

  const cardHeight = height * 0.92;
  const cardWidth = Math.min(width * 0.92, cardHeight * (2.5 / 3.5));
  const cardX = (width - cardWidth) / 2;
  const cardY = (height - cardHeight) / 2;

  const padX = cardWidth * 0.07;
  const titleX = cardX + padX;
  const titleY = cardY + cardHeight * 0.035;
  const titleW = cardWidth - padX * 2;
  const titleH = cardHeight * 0.12;

  return drawRegionUpscaled(image, canvas, titleX, titleY, titleW, titleH, 3);
}

function drawRegionUpscaled(
  source: CanvasImageSource,
  canvas: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  scale: number
): HTMLCanvasElement {
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  // Mild contrast boost helps OCR on glossy card photos.
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = 1.35;
  const intercept = 128 * (1 - contrast);
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const boosted = Math.max(0, Math.min(255, gray * contrast + intercept));
    const value = boosted > 140 ? 255 : boosted < 90 ? 0 : boosted;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

type RecognizeOptions = {
  /** Tesseract page segmentation mode. 7 = single line (title), 6 = block. */
  pageSegMode?: "6" | "7";
};

export async function recognizeCardTitle(
  image: string | HTMLCanvasElement | HTMLImageElement | Blob,
  options: RecognizeOptions = {}
): Promise<string | null> {
  const worker = await getOcrWorker();
  const pageSegMode = options.pageSegMode ?? "7";

  await worker.setParameters({
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' -/.,",
    tessedit_pageseg_mode: pageSegMode
  });

  const result = await worker.recognize(image);
  const raw = (result.data.text || "").trim();
  if (!raw) return null;

  // Prefer the longest plausible line (card titles are usually one line).
  const lines = raw
    .split(/[\r\n]+/)
    .map((line) => cleanOcrText(line))
    .filter((line) => line.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (lines[0]) return lines[0];

  const cleaned = cleanOcrText(raw);
  return cleaned.length >= 2 ? cleaned : null;
}

export async function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Falha ao carregar imagem para OCR."));
      img.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
