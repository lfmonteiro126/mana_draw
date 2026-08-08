import { cleanOcrText } from "@/lib/scanner/scryfall";

type OcrWorker = {
  recognize: (
    image: string | HTMLCanvasElement | HTMLImageElement | Blob
  ) => Promise<{ data: { text: string; confidence: number } }>;
  setParameters: (params: Record<string, string>) => Promise<void>;
  terminate: () => Promise<void>;
};

export type OcrTitleResult = {
  text: string;
  confidence: number;
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

type SourceRect = { x: number; y: number; width: number; height: number };

/**
 * Maps a DOM rect (relative to the video element) into source video pixels,
 * accounting for CSS object-fit: cover cropping/scaling.
 */
export function mapElementRectToVideoPixels(
  video: HTMLVideoElement,
  relativeRect: SourceRect
): SourceRect | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const ew = video.clientWidth;
  const eh = video.clientHeight;
  if (!vw || !vh || !ew || !eh) return null;

  const videoAspect = vw / vh;
  const elementAspect = ew / eh;

  let visibleW: number;
  let visibleH: number;
  let offsetX: number;
  let offsetY: number;

  if (videoAspect > elementAspect) {
    // Wider than the box → left/right crop.
    visibleH = vh;
    visibleW = vh * elementAspect;
    offsetX = (vw - visibleW) / 2;
    offsetY = 0;
  } else {
    // Taller than the box → top/bottom crop.
    visibleW = vw;
    visibleH = vw / elementAspect;
    offsetX = 0;
    offsetY = (vh - visibleH) / 2;
  }

  const scaleX = visibleW / ew;
  const scaleY = visibleH / eh;

  const x = offsetX + relativeRect.x * scaleX;
  const y = offsetY + relativeRect.y * scaleY;
  const width = relativeRect.width * scaleX;
  const height = relativeRect.height * scaleY;

  // Clamp to the video frame.
  const clampedX = Math.max(0, Math.min(vw - 1, x));
  const clampedY = Math.max(0, Math.min(vh - 1, y));
  const clampedW = Math.max(1, Math.min(vw - clampedX, width));
  const clampedH = Math.max(1, Math.min(vh - clampedY, height));

  return { x: clampedX, y: clampedY, width: clampedW, height: clampedH };
}

/** Reads the guide element's box relative to the video element. */
export function getGuideRectRelativeToVideo(
  video: HTMLVideoElement,
  guide: HTMLElement
): SourceRect {
  const videoRect = video.getBoundingClientRect();
  const guideRect = guide.getBoundingClientRect();
  return {
    x: guideRect.left - videoRect.left,
    y: guideRect.top - videoRect.top,
    width: guideRect.width,
    height: guideRect.height
  };
}

/**
 * Crops the on-screen title guide from the live camera, mapped through object-fit: cover.
 */
export function cropGuideFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  guide: HTMLElement,
  options?: { padRatio?: number; scale?: number }
): HTMLCanvasElement | null {
  const relative = getGuideRectRelativeToVideo(video, guide);
  const pad = options?.padRatio ?? 0.08;
  const padded: SourceRect = {
    x: relative.x - relative.width * pad,
    y: relative.y - relative.height * pad * 0.5,
    width: relative.width * (1 + pad * 2),
    height: relative.height * (1 + pad)
  };

  const source = mapElementRectToVideoPixels(video, padded);
  if (!source) return null;

  return drawRegionUpscaled(
    video,
    canvas,
    source.x,
    source.y,
    source.width,
    source.height,
    options?.scale ?? 3
  );
}

/**
 * Fallback crop when guide refs are unavailable: centered card + title band,
 * still corrected for object-fit: cover using the video element's client box.
 */
export function cropCardTitleFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): HTMLCanvasElement | null {
  const ew = video.clientWidth;
  const eh = video.clientHeight;
  if (!ew || !eh) return null;

  // Match the modal guide: centered, aspect 2.5:3.5, max ~280-320 CSS px wide with p-6.
  const availableW = Math.max(1, ew - 48);
  const cardW = Math.min(320, availableW);
  const cardH = cardW * (3.5 / 2.5);
  const cardX = (ew - cardW) / 2;
  const cardY = (eh - cardH) / 2;

  const title: SourceRect = {
    x: cardX + cardW * 0.07,
    y: cardY + cardH * 0.04,
    width: cardW * 0.86,
    height: cardH * 0.12
  };

  const source = mapElementRectToVideoPixels(video, title);
  if (!source) return null;

  return drawRegionUpscaled(
    video,
    canvas,
    source.x,
    source.y,
    source.width,
    source.height,
    3
  );
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
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  // Adaptive threshold: better for glossy cards under mixed lighting.
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const grays = new Uint8ClampedArray(data.length / 4);
  let sum = 0;
  for (let i = 0, g = 0; i < data.length; i += 4, g++) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    grays[g] = gray;
    sum += gray;
  }
  const mean = sum / grays.length;
  const threshold = Math.max(90, Math.min(170, mean * 0.92));

  for (let i = 0, g = 0; i < data.length; i += 4, g++) {
    const contrast = (grays[g] - mean) * 1.45 + mean;
    const value = contrast > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/** Low variance ≈ blurry / empty / no text contrast. Checked before binarization. */
export function estimateRegionContrast(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): number {
  const probe = document.createElement("canvas");
  const tw = Math.max(8, Math.round(sw));
  const th = Math.max(8, Math.round(sh));
  probe.width = Math.min(tw, 240);
  probe.height = Math.min(th, 80);
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, probe.width, probe.height);
  const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 8) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    sum += gray;
    sumSq += gray * gray;
    n++;
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function isPlausibleCardName(text: string): boolean {
  const cleaned = cleanOcrText(text);
  if (cleaned.length < 3 || cleaned.length > 70) return false;

  const letters = cleaned.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length < 3) return false;

  // English/PT card names always have vowels.
  const vowels = (letters.match(/[aeiouyáéíóúâêôãõàèìòù]/gi) || []).length;
  if (vowels === 0) return false;
  if (vowels / letters.length < 0.12) return false;

  // Reject digit-heavy noise.
  const digits = (cleaned.match(/\d/g) || []).length;
  if (digits > letters.length) return false;

  // Each alphabetic token of length >= 3 should contain a vowel (filters "Din SPN").
  const words = cleaned.split(/\s+/).filter(Boolean);
  for (const word of words) {
    const alpha = word.replace(/[^a-zA-ZÀ-ÿ]/g, "");
    if (alpha.length >= 3 && !/[aeiouyáéíóúâêôãõàèìòù]/i.test(alpha)) {
      return false;
    }
  }

  return true;
}

type RecognizeOptions = {
  /** Tesseract page segmentation mode. 7 = single line (title), 6 = block. */
  pageSegMode?: "6" | "7";
  minConfidence?: number;
};

export async function recognizeCardTitle(
  image: string | HTMLCanvasElement | HTMLImageElement | Blob,
  options: RecognizeOptions = {}
): Promise<OcrTitleResult | null> {
  const worker = await getOcrWorker();
  const pageSegMode = options.pageSegMode ?? "7";
  const minConfidence = options.minConfidence ?? 35;

  await worker.setParameters({
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚáéíóúÂÊÔâêôÃÕãõÀàÇç0123456789' -/.,",
    tessedit_pageseg_mode: pageSegMode
  });

  const result = await worker.recognize(image);
  const raw = (result.data.text || "").trim();
  if (!raw) return null;

  const lines = raw
    .split(/[\r\n]+/)
    .map((line) => cleanOcrText(line))
    .filter((line) => line.length >= 2)
    .sort((a, b) => b.length - a.length);

  const text = lines[0] || cleanOcrText(raw);
  if (!text || text.length < 2) return null;

  const confidence = result.data.confidence || 0;
  if (confidence < minConfidence) return null;
  if (!isPlausibleCardName(text)) return null;

  return { text, confidence };
}

/**
 * Tries title-line OCR first, then block mode. Returns the best plausible hit.
 */
export async function recognizeCardTitleRobust(
  image: string | HTMLCanvasElement | HTMLImageElement | Blob
): Promise<OcrTitleResult | null> {
  const primary = await recognizeCardTitle(image, { pageSegMode: "7", minConfidence: 30 });
  if (primary && primary.confidence >= 45) return primary;

  const secondary = await recognizeCardTitle(image, { pageSegMode: "6", minConfidence: 30 });
  if (!primary) return secondary;
  if (!secondary) return primary;
  return secondary.confidence > primary.confidence ? secondary : primary;
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
