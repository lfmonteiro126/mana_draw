import { put } from "@vercel/blob";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function hasBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function storeBuylistPhoto(file: File, submissionId: string) {
  if (file.size <= 0) {
    throw new Error("Arquivo vazio.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Cada foto deve ter no máximo 3 MB.");
  }
  if (file.type && !ALLOWED.has(file.type)) {
    throw new Error("Use JPG, PNG ou WebP.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "foto.jpg";
  const pathname = `buylist/${submissionId}/${Date.now()}-${safeName}`;

  if (hasBlobStorage()) {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type || "image/jpeg",
      addRandomSuffix: true
    });
    return {
      url: blob.url,
      fileName: file.name,
      mimeType: file.type || "image/jpeg",
      sizeBytes: file.size,
      storage: "vercel-blob" as const
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
  return {
    url: dataUrl,
    fileName: file.name,
    mimeType: file.type || "image/jpeg",
    sizeBytes: file.size,
    storage: "data-url" as const
  };
}
