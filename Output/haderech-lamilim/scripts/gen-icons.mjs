// gen-icons.mjs — מייצר אייקוני PWA (placeholder ממותג) מ-SVG בעזרת sharp.
// מוטיב: בועת דיבור לבנה + "שביל" של שלוש נקודות = "הדרך למילים".
// צבע מותג #8ECFDD (theme_color). איתי יכול להחליף בהמשך באייקון מלוטש (gpt-image-gen).
import sharp from "sharp";
import { writeFileSync } from "fs";

const BRAND = "#8ECFDD";
const BRAND_DARK = "#3E7C8C";
const CREAM = "#FAF7EF";

// מוטיב מרכזי (בועת דיבור + שביל נקודות). מקבל viewBox 0..S ומצייר סביב המרכז.
// scale=1 => הבועה תופסת ~72% מהרוחב (לאייקון רגיל). לגרסת maskable נשתמש ב-scale קטן יותר.
function motif(S, scale) {
  const cx = S / 2;
  const cy = S / 2;
  const bw = S * 0.5 * scale; // חצי-רוחב הבועה
  const bh = S * 0.38 * scale; // חצי-גובה הבועה
  const r = S * 0.14 * scale; // רדיוס פינות
  const bx = cx - bw;
  const by = cy - bh - S * 0.03 * scale;
  const tailW = S * 0.11 * scale;
  const tailH = S * 0.14 * scale;
  const tailX = cx - S * 0.02 * scale;
  const tailY = by + bh * 2;
  // שלוש נקודות "שביל" בתוך הבועה
  const dotR = S * 0.045 * scale;
  const dotY = by + bh; // מרכז הבועה אנכית
  const gap = S * 0.16 * scale;
  return `
    <g>
      <!-- זנב הבועה -->
      <path d="M ${tailX} ${tailY - S * 0.04 * scale}
               L ${tailX - tailW / 2} ${tailY + tailH}
               L ${tailX + tailW} ${tailY - S * 0.02 * scale} Z"
            fill="${CREAM}"/>
      <!-- גוף הבועה -->
      <rect x="${bx}" y="${by}" width="${bw * 2}" height="${bh * 2}"
            rx="${r}" ry="${r}" fill="${CREAM}"/>
      <!-- שלוש נקודות = הדרך למילים -->
      <circle cx="${cx - gap}" cy="${dotY}" r="${dotR}" fill="${BRAND_DARK}"/>
      <circle cx="${cx}"       cy="${dotY}" r="${dotR}" fill="${BRAND}"/>
      <circle cx="${cx + gap}" cy="${dotY}" r="${dotR}" fill="${BRAND_DARK}"/>
    </g>`;
}

// אייקון רגיל: רקע עם פינות מעוגלות (יראה כ"אריח") + מוטיב גדול
function iconSvg(S) {
  const rr = S * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#A9DCE6"/>
        <stop offset="1" stop-color="${BRAND}"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${S}" height="${S}" rx="${rr}" ry="${rr}" fill="url(#g)"/>
    ${motif(S, 1)}
  </svg>`;
}

// maskable: רקע במילוי מלא (ריבוע), מוטיב בתוך "אזור בטוח" מרכזי (~60%)
function maskableSvg(S) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#A9DCE6"/>
        <stop offset="1" stop-color="${BRAND}"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${S}" height="${S}" fill="url(#g)"/>
    ${motif(S, 0.74)}
  </svg>`;
}

async function render(svg, size, out) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}

const dir = "public";
// שומרים גם את ה-SVG המקורי (512) לשקיפות/עריכה עתידית
writeFileSync(`${dir}/icon.svg`, iconSvg(512));

await render(iconSvg(192), 192, `${dir}/pwa-192x192.png`);
await render(iconSvg(512), 512, `${dir}/pwa-512x512.png`);
await render(maskableSvg(512), 512, `${dir}/pwa-maskable-512x512.png`);
// apple-touch-icon: רקע מלא (iOS מעגל פינות בעצמו) — משתמשים ב-maskable שהוא full-bleed
await render(maskableSvg(180), 180, `${dir}/apple-touch-icon.png`);
// favicon קטן
await render(iconSvg(48), 48, `${dir}/favicon.png`);
console.log("done");
