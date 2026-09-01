// Renders every card HTML in this folder to a PNG in ./renders/
// Usage:  node render.mjs [file.html ...]      (needs playwright + chromium)
// Transparent cards (lower-third / bug) are captured with omitBackground.
import { createRequire } from 'node:module';
// playwright lives in the global node_modules on this machine; resolve it explicitly so
// the script runs from any cwd without a local install.
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'
);
import { readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'renders');
mkdirSync(outDir, { recursive: true });

const SCALE = 1.2; // 1600x900 -> 1920x1080 ; 900x1600 -> 1080x1920
const TRANSPARENT = /lower-third|bug|disclaimer/;

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(here).filter((f) => f.endsWith('.html')).sort();

const browser = await chromium.launch();
for (const f of files) {
  const portrait = /9x16/.test(f);
  const width = portrait ? 900 : 1600;
  const height = portrait ? 1600 : 900;
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: SCALE,
  });
  await page.goto(pathToFileURL(resolve(here, f)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  const out = resolve(outDir, basename(f).replace(/\.html$/, '.png'));
  await page.screenshot({ path: out, omitBackground: TRANSPARENT.test(f) });
  await page.close();
  console.log(`${basename(f)} -> renders/${basename(out)}  ${width * SCALE}x${height * SCALE}`);
}
await browser.close();
