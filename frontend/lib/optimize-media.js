// Shrinks pictures, videos and audio in the browser BEFORE they are uploaded, so less data is sent and stored.
// (The server re-optimises every image again, because it can never trust what a browser sends.)
//
// Pictures: decoded with the camera's orientation applied, scaled down in halving steps (a single big jump aliases
//   badly), drawn with high-quality smoothing and saved as WebP. All metadata (camera, GPS position) is dropped.
// Video:    re-encoded with the browser's hardware encoder (WebCodecs, through mediabunny): at most 720p, a bitrate
//   suited to the picture size and frame rate, H.264 + AAC in MP4 (WebM VP9 + Opus where H.264 cannot be encoded),
//   with the index at the front so playback starts at once and seeking works while it streams.
// Audio:    re-encoded to AAC (or Opus) at a bitrate that sounds the same for speech and music.
// A result is only used when it is clearly smaller; anything that fails or cannot be improved is sent as it was.

export const IMAGE_PRESETS = {
  avatar: { max: 640, quality: 0.82 },
  cover: { max: 1920, quality: 0.8 },
  post: { max: 1920, quality: 0.8 },
  course: { max: 1600, quality: 0.82 },
  instructor: { max: 800, quality: 0.82 },
  submission: { max: 2048, quality: 0.82 },
};

const VIDEO_MAX_SIDE = 1280; // 720p
const VIDEO_MIN_BYTES = 4 * 1024 * 1024; // smaller videos are not worth the processing time
const AUDIO_MIN_BYTES = 600 * 1024;
const MUST_SAVE = 0.9; // a video or audio result must be at least 10% smaller than the original

export function formatSize(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const unchanged = (file) => ({ file, changed: false, before: file.size, after: file.size });
const renamed = (file, extension) => file.name.replace(/\.[^./\\]+$/, "") + extension;

/* ------------------------------------------------------------------------------------------ pictures */

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to an <img> element below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function surface(width, height) {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function toBlob(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function optimizeImage(file, presetName = "post") {
  const preset = IMAGE_PRESETS[presetName] || IMAGE_PRESETS.post;
  // Animated or vector pictures would lose their nature on a canvas; the server handles GIFs, SVG is never accepted.
  if (!/^image\/(jpeg|png|webp|avif|bmp)$/i.test(file.type)) return unchanged(file);
  try {
    const source = await decodeImage(file);
    const sourceWidth = source.naturalWidth || source.width;
    const sourceHeight = source.naturalHeight || source.height;
    const ratio = Math.min(1, preset.max / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));
    // Halve repeatedly while the target is less than half the current size, then do the last step.
    let current = source;
    let currentWidth = sourceWidth;
    let currentHeight = sourceHeight;
    while (currentWidth / 2 >= width && currentHeight / 2 >= height) {
      currentWidth = Math.round(currentWidth / 2);
      currentHeight = Math.round(currentHeight / 2);
      const step = surface(currentWidth, currentHeight);
      const stepContext = step.getContext("2d");
      stepContext.imageSmoothingEnabled = true;
      stepContext.imageSmoothingQuality = "high";
      stepContext.drawImage(current, 0, 0, currentWidth, currentHeight);
      current = step;
    }
    const canvas = surface(width, height);
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(current, 0, 0, width, height);
    source.close?.();
    let blob = await toBlob(canvas, "image/webp", preset.quality);
    let extension = ".webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob(canvas, "image/jpeg", preset.quality);
      extension = ".jpg";
    }
    if (!blob) return unchanged(file);
    const resized = ratio < 1;
    if (blob.size >= file.size && !resized) return unchanged(file); // already compact: keep the original bytes
    const optimized = new File([blob], renamed(file, extension), { type: blob.type, lastModified: Date.now() });
    return { file: optimized, changed: true, before: file.size, after: optimized.size, width, height };
  } catch {
    return unchanged(file);
  }
}

/* ------------------------------------------------------------------------------------------ video and audio */

async function openInput(mediabunny, file) {
  const { Input, BlobSource, ALL_FORMATS } = mediabunny;
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

async function run(conversion, { onProgress, signal }) {
  if (!conversion.isValid) throw new Error("This file cannot be converted here.");
  conversion.onProgress = (value) => onProgress?.(Math.min(0.99, value));
  const stop = () => conversion.cancel().catch(() => {});
  signal?.addEventListener("abort", stop, { once: true });
  try {
    await conversion.execute();
  } finally {
    signal?.removeEventListener("abort", stop);
  }
}

export async function optimizeVideo(file, { onProgress, signal } = {}) {
  if (file.size < VIDEO_MIN_BYTES) return unchanged(file);
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return unchanged(file);
  let input;
  try {
    const mediabunny = await import("mediabunny");
    const { Output, Conversion, BufferTarget, Mp4OutputFormat, WebMOutputFormat, getFirstEncodableVideoCodec, getFirstEncodableAudioCodec } = mediabunny;
    input = await openInput(mediabunny, file);
    const video = await input.getPrimaryVideoTrack();
    if (!video) return unchanged(file);
    const [duration, stats] = await Promise.all([input.computeDuration(), video.computePacketStats(120)]);
    const side = Math.max(video.displayWidth, video.displayHeight);
    const scale = Math.min(1, VIDEO_MAX_SIDE / side);
    const width = Math.max(2, Math.round((video.displayWidth * scale) / 2) * 2);
    const height = Math.max(2, Math.round((video.displayHeight * scale) / 2) * 2);
    const fps = Math.min(30, Math.max(15, stats.averagePacketRate || 30));
    // About 0.07 bits per pixel per frame is visually transparent for lectures and phone footage with H.264.
    const targetBitrate = Math.round(Math.min(3_500_000, Math.max(450_000, width * height * fps * 0.07)));
    const sourceBitrate = stats.averageBitrate || (file.size * 8) / Math.max(1, duration);
    if (scale === 1 && sourceBitrate <= targetBitrate * 1.25) return unchanged(file); // already efficient

    const videoCodec = await getFirstEncodableVideoCodec(["avc", "vp9"], { width, height });
    if (!videoCodec) return unchanged(file);
    const mp4 = videoCodec === "avc";
    const audioCodec = await getFirstEncodableAudioCodec(mp4 ? ["aac", "opus"] : ["opus"]);
    const output = new Output({ format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      video: { width, height, fit: "contain", codec: videoCodec, bitrate: targetBitrate, frameRate: scale < 1 || fps < (stats.averagePacketRate || 0) ? fps : undefined, keyFrameInterval: 2 },
      audio: audioCodec ? { codec: audioCodec, bitrate: 96_000, numberOfChannels: 2 } : { discard: true },
    });
    await run(conversion, { onProgress, signal });
    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength > file.size * MUST_SAVE) return unchanged(file);
    const type = mp4 ? "video/mp4" : "video/webm";
    const optimized = new File([buffer], renamed(file, mp4 ? ".mp4" : ".webm"), { type, lastModified: Date.now() });
    onProgress?.(1);
    return { file: optimized, changed: true, before: file.size, after: optimized.size, width, height };
  } catch {
    return unchanged(file);
  } finally {
    input?.dispose?.();
  }
}

export async function optimizeAudio(file, { onProgress, signal } = {}) {
  if (file.size < AUDIO_MIN_BYTES) return unchanged(file);
  if (typeof AudioEncoder === "undefined" || typeof AudioDecoder === "undefined") return unchanged(file);
  let input;
  try {
    const mediabunny = await import("mediabunny");
    const { Output, Conversion, BufferTarget, Mp4OutputFormat, WebMOutputFormat, getFirstEncodableAudioCodec } = mediabunny;
    input = await openInput(mediabunny, file);
    const audio = await input.getPrimaryAudioTrack();
    if (!audio) return unchanged(file);
    const [duration, stats] = await Promise.all([input.computeDuration(), audio.computePacketStats(200)]);
    const sourceBitrate = stats.averageBitrate || (file.size * 8) / Math.max(1, duration);
    const channels = Math.min(2, audio.numberOfChannels || 2);
    const targetBitrate = channels === 1 ? 64_000 : 112_000;
    if (sourceBitrate <= targetBitrate * 1.3) return unchanged(file); // already small enough (MP3 128k, AAC ...)
    const codec = await getFirstEncodableAudioCodec(["aac", "opus"]);
    if (!codec) return unchanged(file);
    const mp4 = codec === "aac";
    const output = new Output({ format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true },
      audio: { codec, bitrate: targetBitrate, numberOfChannels: channels, sampleRate: Math.min(48_000, audio.sampleRate || 48_000) },
    });
    await run(conversion, { onProgress, signal });
    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength > file.size * MUST_SAVE) return unchanged(file);
    const optimized = new File([buffer], renamed(file, mp4 ? ".m4a" : ".webm"), { type: mp4 ? "audio/mp4" : "audio/webm", lastModified: Date.now() });
    onProgress?.(1);
    return { file: optimized, changed: true, before: file.size, after: optimized.size };
  } catch {
    return unchanged(file);
  } finally {
    input?.dispose?.();
  }
}

/**
 * Optimises whatever it is given: pictures (with the named preset), video and audio. Anything else (PDF, documents,
 * archives, code) is returned as it is. Resolves to { file, changed, before, after }.
 *   preset     which picture size to aim for (see IMAGE_PRESETS)
 *   onProgress called with 0..1 while a video or audio file is being converted
 *   signal     an AbortSignal that stops a conversion (the original file is then returned)
 */
export async function optimizeFile(file, { preset = "post", onProgress, signal } = {}) {
  if (!file || signal?.aborted) return unchanged(file);
  if (file.type.startsWith("image/")) return optimizeImage(file, preset);
  if (file.type.startsWith("video/")) return optimizeVideo(file, { onProgress, signal });
  if (file.type.startsWith("audio/")) return optimizeAudio(file, { onProgress, signal });
  return unchanged(file);
}

/** True for the kinds of file that optimizeFile can shrink. */
export const canOptimize = (file) => /^(image|video|audio)\//.test(file?.type || "");
