const SIZE = 250; // 2× the 125px tile, so it stays sharp on high-res screens
const PREVIEW_MAX = 1024; // longest side of the full-size preview

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

// Older Safari can't encode WebP and quietly gives back PNG instead. JPEG
// has no transparency, so put a white background behind the image first
// instead of letting transparent areas turn black.
function fillWhiteBehind(canvas, context) {
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

// The tile: a centred square crop, SIZE×SIZE, as a data URL (~20–40 KB).
function makeThumbnail(bitmap) {
  // Scale so the shorter side fills the square, then take the middle of
  // the longer side. srcW/srcH are the source square in original pixels.
  const scale = Math.max(SIZE / bitmap.width, SIZE / bitmap.height);
  const srcW = SIZE / scale;
  const srcH = SIZE / scale;
  const srcX = (bitmap.width - srcW) / 2;
  const srcY = (bitmap.height - srcH) / 2;

  const { canvas, context } = makeCanvas(SIZE, SIZE);
  context.drawImage(bitmap, srcX, srcY, srcW, srcH, 0, 0, SIZE, SIZE);

  const webp = canvas.toDataURL("image/webp", 0.8);
  if (webp.startsWith("data:image/webp")) return webp;
  fillWhiteBehind(canvas, context);
  return canvas.toDataURL("image/jpeg", 0.8);
}

const toBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode image"))), type, quality)
  );

// The preview: the whole image, uncropped, shrunk to fit PREVIEW_MAX (never
// enlarged), as a Blob (~100–200 KB). A Blob rather than a data URL because
// it's a third smaller and is stored outside the list (see storage.js).
async function makePreview(bitmap) {
  const scale = Math.min(1, PREVIEW_MAX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const { canvas, context } = makeCanvas(width, height);
  context.drawImage(bitmap, 0, 0, width, height);

  const webp = await toBlob(canvas, "image/webp", 0.85);
  if (webp.type === "image/webp") return webp;
  fillWhiteBehind(canvas, context);
  return toBlob(canvas, "image/jpeg", 0.85);
}

// Decodes an image file once and makes both versions from it. Returns
// { thumbnail, preview }. Rejects if the browser can't decode the file.
export async function processImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const preview = await makePreview(bitmap);
    const thumbnail = makeThumbnail(bitmap);
    return { thumbnail, preview };
  } finally {
    bitmap.close();
  }
}
