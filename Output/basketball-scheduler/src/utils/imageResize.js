// Client-side logo processing for the club settings screen.
//
// The logo is stored as a data URI inside the club document rather than in Firebase
// Storage. Two reasons:
//   1. A Storage-hosted logo lives on another origin, and the weekly board / coach
//      report are composited onto a <canvas> — a cross-origin image taints the canvas
//      and makes toBlob() fail, which is exactly the class of bug this app already
//      fought through on mobile. A data URI is same-origin and always safe.
//   2. No extra Firebase product to configure per club.
//
// The tradeoff is size: the club document has a 1 MiB ceiling, so the image is scaled
// down and compressed before it ever reaches Firestore.

export const LOGO_MAX_PX = 256; // enough for a 64px header logo on a 3x display
export const LOGO_MAX_BYTES = 70 * 1024; // keeps the logo a small slice of the document

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(new Error("read-failed"));
    fr.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = src;
  });

// Longest side capped at maxPx, aspect ratio preserved, never upscaled.
export function fitDimensions(w, h, maxPx) {
  if (!w || !h) return { width: 0, height: 0 };
  const scale = Math.min(1, maxPx / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

// Rough byte size of a data URI's payload (base64 encodes 3 bytes as 4 chars).
export function dataUrlBytes(dataUrl) {
  const i = String(dataUrl || "").indexOf(",");
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

// Returns { dataUrl, bytes, width, height, format }.
// Tries PNG first to preserve transparency; falls back to progressively stronger JPEG
// (flattened onto white) only when PNG would be too heavy for the document.
export async function fileToLogoDataUrl(file, opts = {}) {
  const maxPx = opts.maxPx || LOGO_MAX_PX;
  const maxBytes = opts.maxBytes || LOGO_MAX_BYTES;

  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("not-an-image");
  }

  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, maxPx);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const png = canvas.toDataURL("image/png");
  if (dataUrlBytes(png) <= maxBytes) {
    return { dataUrl: png, bytes: dataUrlBytes(png), width, height, format: "png" };
  }

  // Flatten onto white before JPEG — otherwise transparent areas encode as black.
  const flat = document.createElement("canvas");
  flat.width = width;
  flat.height = height;
  const fctx = flat.getContext("2d");
  fctx.fillStyle = "#FFFFFF";
  fctx.fillRect(0, 0, width, height);
  fctx.drawImage(img, 0, 0, width, height);

  let best = null;
  for (const q of [0.92, 0.85, 0.75, 0.6, 0.45]) {
    const jpg = flat.toDataURL("image/jpeg", q);
    best = { dataUrl: jpg, bytes: dataUrlBytes(jpg), width, height, format: "jpeg" };
    if (best.bytes <= maxBytes) break;
  }
  return best;
}
