import { put } from "@vercel/blob";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function hasBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // HEIC/HEIF often start with ftyp....heic/heif/mif1
  if (bytes.length >= 12) {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (brand === "heic" || brand === "heif" || brand === "mif1" || brand === "msf1") {
      return brand.startsWith("he") ? `image/${brand}` : "image/heif";
    }
  }
  return null;
}

export async function storeBuylistPhoto(file: File, submissionId: string) {
  if (file.size <= 0) {
    throw new Error("Arquivo vazio.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Cada foto deve ter no máximo 3 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMime(buffer);
  const declared = file.type || "";

  if (!sniffed) {
    throw new Error("Use JPG, PNG ou WebP.");
  }
  if (declared && !ALLOWED.has(declared)) {
    throw new Error("Use JPG, PNG ou WebP.");
  }
  if (declared && declared !== sniffed && !(declared.startsWith("image/he") && sniffed.startsWith("image/he"))) {
    throw new Error("Tipo de arquivo inválido.");
  }

  const mimeType = sniffed;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "foto.jpg";
  const pathname = `buylist/${submissionId}/${Date.now()}-${safeName}`;

  if (hasBlobStorage()) {
    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: true
    });
    return {
      url: blob.url,
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
      storage: "vercel-blob" as const
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Upload de fotos exige BLOB_READ_WRITE_TOKEN em produção.");
  }

  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  return {
    url: dataUrl,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
    storage: "data-url" as const
  };
}
