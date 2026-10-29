// Server-side image optimisation for everything people upload (profile pictures, covers, showcase pictures,
// course covers, instructor photos, contest entries).
//
// Whatever the browser sent, every image is re-encoded here, because the server cannot trust the client:
//   - it is turned the right way up from its EXIF orientation, and ALL metadata is stripped (camera model, and above all
//     the GPS position a phone photo carries, which would otherwise be published with the picture);
//   - it is scaled down to the size it will ever be shown at (never enlarged), with a high-quality resampler (Lanczos3);
//   - it is saved as WebP (about 25-35% smaller than JPEG at the same quality, with transparency and animation), unless
//     that would not make it smaller, in which case the original bytes are kept;
//   - absurdly large images ("decompression bombs") and files that are not really images are refused.
// libvips (through "sharp") does the work. If it cannot be loaded on a host, uploads still work and are stored as sent.
import fs from "node:fs";
import { ApiError } from "./common.js";

export const IMAGE_PRESETS = {
  avatar: { width: 640, height: 640, quality: 82 },
  cover: { width: 1920, height: 1080, quality: 80 },
  post: { width: 1920, height: 1920, quality: 80 },
  course: { width: 1600, height: 1600, quality: 82 },
  instructor: { width: 800, height: 800, quality: 82 },
  submission: { width: 2048, height: 2048, quality: 82 },
};

const MAX_PIXELS = 50_000_000; // about 7000 x 7000
const MAX_FRAMES = 150; // animated images with more frames are stored as they are

let sharpLoader;
function loadSharp() {
  sharpLoader ??= import("sharp")
    .then((module) => {
      const sharp = module.default;
      sharp.cache(false); // a small host should not keep decoded images in memory
      sharp.concurrency(1);
      return sharp;
    })
    .catch((error) => {
      console.error("[media] image optimisation is switched off:", error.message);
      return null;
    });
  return sharpLoader;
}

/**
 * Optimises one image. Returns { buffer, mimetype, width, height, optimized } - or the input unchanged
 * (optimized: false) when it cannot be improved. Throws a 422 ApiError when the bytes are not a readable image.
 */
export async function optimizeImage(buffer, mimetype, presetName = "post") {
  const preset = IMAGE_PRESETS[presetName] || IMAGE_PRESETS.post;
  const sharp = await loadSharp();
  if (!sharp) return { buffer, mimetype, optimized: false };
  try {
    const animatedInput = mimetype === "image/gif" || mimetype === "image/webp";
    const probe = await sharp(buffer, { animated: animatedInput, limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
    const frames = probe.pages || 1;
    if (frames > MAX_FRAMES) return { buffer, mimetype, optimized: false };
    const result = await sharp(buffer, { animated: animatedInput && frames > 1, limitInputPixels: MAX_PIXELS, failOn: "error" })
      .rotate() // apply the EXIF orientation; the output carries no metadata at all
      .resize({ width: preset.width, height: preset.height, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
      .webp({ quality: preset.quality, effort: 4, smartSubsample: true, alphaQuality: 90 })
      .toBuffer({ resolveWithObject: true });
    const hasMetadata = Boolean(probe.exif || probe.xmp || probe.iptc);
    const smaller = result.data.length < buffer.length;
    // An already well-compressed, metadata-free image is left alone rather than re-encoded to something bigger.
    if (!smaller && !hasMetadata) return { buffer, mimetype, width: probe.width, height: probe.height, optimized: false };
    return { buffer: result.data, mimetype: "image/webp", width: result.info.width, height: result.info.height, optimized: true };
  } catch (error) {
    if (/pixel limit|exceeds pixel/i.test(String(error.message))) throw new ApiError(422, "That image is too large in pixels. Use one under 50 megapixels.");
    throw new ApiError(422, "That image could not be read. Use a JPEG, PNG, WebP, GIF or AVIF picture.");
  }
}

/** Optimises a multer file held in memory (file.buffer) and updates its type and size. Files that are not images pass through. */
export async function optimizeUpload(file, presetName) {
  if (!file?.mimetype?.startsWith("image/") || !file.buffer) return file;
  const result = await optimizeImage(file.buffer, file.mimetype, presetName);
  if (result.optimized) {
    file.buffer = result.buffer;
    file.mimetype = result.mimetype;
    file.size = result.buffer.length;
    if (file.originalname) file.originalname = file.originalname.replace(/\.[^.]+$/, "") + ".webp";
  }
  return file;
}

/** Same for a file multer saved to disk (file.path). The file on disk is replaced and file.path / size / mimetype updated. */
export async function optimizeStoredUpload(file, presetName) {
  if (!file?.mimetype?.startsWith("image/") || !file.path) return file;
  const buffer = await fs.promises.readFile(file.path);
  const result = await optimizeImage(buffer, file.mimetype, presetName);
  if (result.optimized) {
    const next = file.path.replace(/\.[^./\\]+$/, "") + ".webp";
    await fs.promises.writeFile(next, result.buffer);
    if (next !== file.path) await fs.promises.unlink(file.path).catch(() => {});
    file.path = next;
    file.filename = file.filename ? file.filename.replace(/\.[^.]+$/, "") + ".webp" : file.filename;
    file.mimetype = result.mimetype;
    file.size = result.buffer.length;
    if (file.originalname) file.originalname = file.originalname.replace(/\.[^.]+$/, "") + ".webp";
  }
  return file;
}
