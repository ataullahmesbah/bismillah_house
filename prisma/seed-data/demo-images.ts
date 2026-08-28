import fs from "node:fs";
import path from "node:path";

/**
 * Demo imagery for the seed.
 *
 * The seed used to point at an external placeholder service, which meant the
 * shop looked broken whenever that host was slow, blocked or offline — a real
 * possibility on the networks this platform is built for. Instead the images
 * are rendered locally into `public/demo/` and served from the app itself, so
 * a freshly seeded shop looks complete with no internet connection at all.
 *
 * These are demo assets. Replace them with real photography from the dashboard
 * (Products → Images) before going anywhere near production.
 */

const DEMO_DIR = path.join(process.cwd(), "public", "demo");

/** Brand-ish greys matching the design tokens in globals.css. */
const BACKGROUNDS = ["#eceef0", "#e4e7ea", "#dfe3e6", "#e8ebed"];
const INK = "#23272d";

type Request = { text: string; size: number };

const requested = new Map<string, Request>();

function fileSlug(text: string, size: number): string {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "image"}-${size}`;
}

/**
 * Records an image to render and returns the public path the seed should
 * store. Nothing is written until `renderDemoImages()` runs.
 */
export function demoImage(text: string, size = 800): string {
  const slug = fileSlug(text, size);
  if (!requested.has(slug)) requested.set(slug, { text, size });
  return `/demo/${slug}.png`;
}

/**
 * True for images this seed produced, in any generation — the current local
 * paths and the external placeholder host earlier versions used.
 *
 * Refreshing demo artwork must never touch a real photograph an admin
 * uploaded, so every update is gated on this.
 */
export function isDemoImage(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("/demo/") || url.includes("placehold.co");
}

/** Splits a label into lines short enough to read inside the square. */
function wrap(text: string, perLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > perLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function svgFor({ text, size }: Request, index: number): string {
  const background = BACKGROUNDS[index % BACKGROUNDS.length];
  const fontSize = Math.max(14, Math.round(size / 14));
  const lines = wrap(text, Math.max(10, Math.round(size / fontSize) + 2));
  const lineHeight = Math.round(fontSize * 1.3);
  const startY = Math.round(size / 2 - ((lines.length - 1) * lineHeight) / 2);

  const escaped = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const tspans = lines
    .map((line, i) => `<tspan x="50%" y="${startY + i * lineHeight}">${escaped(line)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  <rect x="${size * 0.06}" y="${size * 0.06}" width="${size * 0.88}" height="${size * 0.88}"
        fill="none" stroke="${INK}" stroke-opacity="0.12" stroke-width="${Math.max(1, size / 200)}" rx="${size * 0.03}"/>
  <text font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="600"
        fill="${INK}" fill-opacity="0.72" text-anchor="middle">${tspans}</text>
</svg>`;
}

/**
 * Writes every image requested during seeding. Skips silently if `sharp` is
 * unavailable — the seed's job is the data, and a missing thumbnail must never
 * be the thing that fails it.
 */
export async function renderDemoImages(): Promise<string> {
  if (requested.size === 0) return "no demo images requested";

  let sharp: typeof import("sharp").default;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return `skipped ${requested.size} demo images (sharp is not installed)`;
  }

  fs.mkdirSync(DEMO_DIR, { recursive: true });

  let written = 0;
  let reused = 0;
  let index = 0;

  for (const [slug, request] of requested) {
    index += 1;
    const target = path.join(DEMO_DIR, `${slug}.png`);
    if (fs.existsSync(target)) {
      reused += 1;
      continue;
    }
    const svg = Buffer.from(svgFor(request, index));
    await sharp(svg).png({ compressionLevel: 9, palette: true }).toFile(target);
    written += 1;
  }

  return `${written} demo images written, ${reused} already present → public/demo`;
}
