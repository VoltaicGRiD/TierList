import { processImage } from "./components/imageScaler";

// How many images are decoded at once. Each full-size photo can take
// ~50 MB of memory while decoding, so this stays small.
const CONCURRENCY = 4;

const isImage = (file) => file.type.startsWith("image/");
const baseName = (fileName) => fileName.replace(/\.[^.]+$/, "");

// Sort like a file browser does: "img2" before "img10", folders grouped.
const byPath = (a, b) =>
  (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });

// Shrinks every image in `files` (non-images, e.g. from a folder, are
// skipped). Calls onProgress(done, total) as each one finishes. Returns
// { images: [{ name, image, preview }], failed: [file names] } with images in
// file-name order.
export async function importImages(files, onProgress = () => {}) {
  const queue = Array.from(files).filter(isImage).sort(byPath);
  const results = new Array(queue.length);
  const failed = [];
  let next = 0;
  let done = 0;
  onProgress(0, queue.length);

  const worker = async () => {
    while (next < queue.length) {
      const index = next++;
      const file = queue[index];
      try {
        const { thumbnail, preview } = await processImage(file);
        results[index] = { name: baseName(file.name), image: thumbnail, preview };
      } catch (error) {
        console.error(`Couldn't load image "${file.name}"`, error);
        failed.push(file.name);
      }
      onProgress(++done, queue.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  return { images: results.filter(Boolean), failed };
}
