// Draws the app icons in public/icons from the logo mark (components/brand/logo.tsx):
// a green tile with the "H" and the sun dot. Run after changing the mark: node scripts/build-icons.mjs
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const BRAND = "#22c55e";
const SUN = "#ffc83d";

/** `glyph` is the share of the canvas the 24×24 mark takes; `radius` rounds the tile (0 for full-bleed). */
function svg(size, { glyph, radius }) {
  const g = size * glyph;
  const offset = (size - g) / 2;
  const scale = g / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${BRAND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 5v14M18 5v14M6 12h12"/>
    <circle cx="18" cy="5" r="1.4" fill="${SUN}" stroke="none"/>
  </g>
</svg>`;
}

const icons = [
  { file: "icon-192.png", size: 192, glyph: 0.62, radius: 0.22 },
  { file: "icon-512.png", size: 512, glyph: 0.62, radius: 0.22 },
  // Maskable: full-bleed, mark inside the 80% safe zone so any mask shape keeps it whole.
  { file: "icon-maskable-512.png", size: 512, glyph: 0.46, radius: 0 },
  // iOS rounds the corners itself.
  { file: "apple-touch-icon.png", size: 180, glyph: 0.6, radius: 0 },
];

mkdirSync("public/icons", { recursive: true });
for (const { file, size, ...shape } of icons) {
  await sharp(Buffer.from(svg(size, shape))).png().toFile(`public/icons/${file}`);
  console.log(`Wrote public/icons/${file}`);
}
