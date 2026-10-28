// Renders a game's app icon, drawn as SVG by the game, into the source
// images for `npm run app-images` (<game>/assets/app) and the web favicon
// (<game>/public/favicon.ico), using headless Edge. Each game calls this
// from its own tools/make-icon.mjs.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

/**
 * @param {string} root the game's folder
 * @param {(zoomOut: number) => string} svg the icon as a square SVG; with
 *   zoomOut 1.5 it must show 1.5 times as much around the same centre
 * @param {string} background the icon's background colour
 */
export function makeAppIcon(root, svg, background) {
  const out = join(root, 'assets/app');
  const work = mkdtempSync(join(tmpdir(), 'app-icon-'));
  const render = (svgText, size, file) => {
    const page = join(work, 'icon.html');
    writeFileSync(page, `<html><body style="margin:0">${svgText.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    execFileSync(EDGE, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
      `--user-data-dir=${join(work, 'profile')}`, '--default-background-color=00000000',
      `--window-size=${size},${size}`, `--screenshot=${file}`, pathToFileURL(page).href,
    ], { stdio: 'ignore' });
  };

  mkdirSync(out, { recursive: true });
  // Older launchers show the whole square (rounding its corners).
  render(svg(1), 1024, join(out, 'icon-only.png'));
  // Adaptive icons show only the middle two thirds of the layer, masked to a
  // shape: draw 1.5 times wider, so the same view is what shows.
  render(svg(1.5), 1024, join(out, 'icon-foreground.png'));
  render(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="${background}"/></svg>`, 1024, join(out, 'icon-background.png'));
  // Android launch screen before Android 12: the studio's, shared by every game.
  copyFileSync(join(root, 'games-common-core/assets/app/splash.png'), join(out, 'splash.png'));

  // Favicon: an .ico holding 32 and 48 pixel PNGs.
  const pngs = [32, 48].map((size) => {
    const file = join(work, `favicon-${size}.png`);
    render(svg(1), size, file);
    return { size, data: readFileSync(file) };
  });
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  writeFileSync(join(root, 'public/favicon.ico'), Buffer.concat([header, ...pngs.map((p) => p.data)]));

  rmSync(work, { recursive: true, force: true });
  console.log('Wrote assets/app/*.png and public/favicon.ico. Next: npm run app-images');
}
