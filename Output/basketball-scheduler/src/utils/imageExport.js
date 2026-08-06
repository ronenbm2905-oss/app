// Shared image-export helpers for WhatsApp-friendly schedule sharing.
// We render a DOM node to a PNG via html2canvas, composite the club logo (and an
// optional title) on top ourselves — html2canvas does not reliably paint <img> on
// mobile — then hand the image to the OS share sheet (mobile → WhatsApp) or download it.
// This sidesteps browser print quirks entirely (portrait/landscape, multi-page).

// Load an image URL as a data URI so it needs no network fetch at capture time —
// which is what mobile browsers were failing to paint into the html2canvas snapshot.
export async function loadImageDataUrl(src) {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

// Draw the club logo (and optional title) centered above an already-captured canvas
// and return a new, taller canvas. We composite ourselves because html2canvas does
// not reliably paint <img> on mobile.
export async function withLogoHeader(baseCanvas, logoSrc, title = "") {
  try {
    const logo = new Image();
    logo.src = logoSrc;
    try { await logo.decode(); } catch { await new Promise((r) => { logo.onload = r; logo.onerror = r; }); }
    const hasLogo = !!logo.naturalWidth;
    const pad = 28;
    const logoH = hasLogo ? Math.min(170, logo.naturalHeight) : 0;
    const logoW = hasLogo ? Math.round(logoH * (logo.naturalWidth / logo.naturalHeight)) : 0;
    const fontSize = 44;
    const titleH = title ? fontSize + 20 : 0;
    const headerH = logoH + titleH + pad * 2;
    if (!headerH) return baseCanvas;
    const out = document.createElement("canvas");
    out.width = baseCanvas.width;
    out.height = baseCanvas.height + headerH;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    if (hasLogo) ctx.drawImage(logo, Math.round((out.width - logoW) / 2), pad, logoW, logoH);
    if (title) {
      ctx.fillStyle = "#292524";
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.direction = "rtl";
      ctx.fillText(title, out.width / 2, pad + logoH + titleH / 2);
    }
    ctx.drawImage(baseCanvas, 0, headerH);
    return out;
  } catch {
    return baseCanvas;
  }
}

// Capture a DOM node to a PNG blob, compositing logo + optional title on top.
export async function captureNode(node, { logoSrc = "", title = "", scale = 2 } = {}) {
  const { default: html2canvas } = await import("html2canvas");
  const baseCanvas = await html2canvas(node, { scale, backgroundColor: "#ffffff" });
  const finalCanvas = logoSrc || title ? await withLogoHeader(baseCanvas, logoSrc, title) : baseCanvas;
  return await new Promise((resolve) => finalCanvas.toBlob(resolve, "image/png"));
}

// Hand a PNG blob to the OS share sheet (mobile → WhatsApp) or download it (desktop).
export async function shareOrDownloadBlob(blob, fileName, shareTitle) {
  if (!blob) throw new Error("no blob");
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareTitle });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // user cancelled the share sheet
      // otherwise fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
