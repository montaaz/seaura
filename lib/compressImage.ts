/**
 * Client-side image compression.
 *
 * The admin panel stores images as base64 data-URLs directly in Postgres.
 * Without compression, a raw phone photo becomes a 20-40 MB base64 string,
 * which makes every subsequent read painfully slow (see scripts/migrate-images.js).
 *
 * This helper resizes an uploaded File to a sane max dimension and re-encodes
 * it as a compressed WebP data-URL before it ever reaches the database, so new
 * uploads stay in the ~100-300 KB range instead of tens of megabytes.
 */
export async function compressImageFile(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<string> {
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.8;

  // Non-images (or SVGs, which don't rasterize well) pass through untouched.
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return readAsDataURL(file);
  }

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl; // fall back to original if canvas unavailable

  ctx.drawImage(img, 0, 0, width, height);

  const compressed = canvas.toDataURL("image/webp", quality);
  // Guard against edge cases where WebP encoding produces something larger
  // (or is unsupported and returns a PNG data-URL bigger than the source).
  return compressed.length < dataUrl.length ? compressed : dataUrl;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
