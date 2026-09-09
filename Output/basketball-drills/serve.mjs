/* שרת סטטי מינימלי להרצה מקומית. Service Worker דורש http ולא file://.
   הרצה:  node serve.mjs        →  http://localhost:8000
   אין תלויות, אין build. הקובץ הזה הוא כלי פיתוח בלבד ולא חלק מהאפליקציה. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 8000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png":  "image/png",
  ".svg":  "image/svg+xml"
};

http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(ROOT, rel === "/" ? "index.html" : rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"   // בפיתוח רוצים לראות את השינוי, לא את המטמון
    });
    res.end(buf);
  });
}).listen(PORT, () => console.log("http://localhost:" + PORT));
