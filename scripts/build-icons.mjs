// Draws the app icons from the logo mark (components/brand/logo.tsx): an ink tile with a white "H".
// Writes the install icons in public/icons and the browser-tab icons in app/ (favicon.ico,
// icon.svg, apple-icon.png), which Next.js links from every page.
// Run after changing the mark: node scripts/build-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const INK = "#1b1b1d";
const PAPER = "#ededef";
const MARK = "M7 5v14M17 5v14M7 12h10";

/** `glyph` is the share of the canvas the 24×24 mark takes; `radius` rounds the tile (0 for full-bleed). */
function svg(size, { glyph, radius }) {
  const g = size * glyph;
  const offset = (size - g) / 2;
  const scale = g / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${INK}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="${MARK}"/>
  </g>
</svg>`;
}

/** The tab icon for browsers that take SVG: inverts on dark browser themes, like the logo does. */
const tabSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <style>
    .tile { fill: ${INK}; } .mark { stroke: #fff; }
    @media (prefers-color-scheme: dark) { .tile { fill: ${PAPER}; } .mark { stroke: ${INK}; } }
  </style>
  <rect class="tile" width="24" height="24" rx="5.3"/>
  <g transform="translate(3.6 3.6) scale(0.7)" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <path class="mark" d="${MARK}"/>
  </g>
</svg>
`;

/** An .ico holding PNG images, one per size (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6 + pngs.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header[entry] = size;
    header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const png = (size, shape) => sharp(Buffer.from(svg(size, shape))).png().toBuffer();

const icons = [
  { file: "public/icons/icon-192.png", size: 192, glyph: 0.62, radius: 0.22 },
  { file: "public/icons/icon-512.png", size: 512, glyph: 0.62, radius: 0.22 },
  // Maskable: full-bleed, mark inside the 80% safe zone so any mask shape keeps it whole.
  { file: "public/icons/icon-maskable-512.png", size: 512, glyph: 0.46, radius: 0 },
  // iOS rounds the corners itself.
  { file: "app/apple-icon.png", size: 180, glyph: 0.6, radius: 0 },
];

mkdirSync("public/icons", { recursive: true });
for (const { file, size, ...shape } of icons) {
  writeFileSync(file, await png(size, shape));
  console.log(`Wrote ${file}`);
}

// A bigger mark at tab sizes, so the "H" stays legible at 16 px.
const tab = { glyph: 0.7, radius: 0.22 };
writeFileSync("app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size, tab) })))));
console.log("Wrote app/favicon.ico");
writeFileSync("app/icon.svg", tabSvg);
console.log("Wrote app/icon.svg");
