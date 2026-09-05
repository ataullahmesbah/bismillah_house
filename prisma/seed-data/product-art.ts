/**
 * Drawn product artwork for the demo catalogue.
 *
 * A catalogue full of grey boxes with the product name typed on them does not
 * tell you whether the shop looks right — the cards, the grid, the gallery and
 * the colour swatches all read differently once there is a real object in the
 * frame. So each product type is drawn here as an SVG illustration: a
 * silhouette on a soft studio background, with a gradient, a highlight and a
 * ground shadow, in whatever colour the variant calls for.
 *
 * These are ILLUSTRATIONS, not photographs. They exist so the storefront can be
 * judged before anyone has photographed a single product, and they are meant to
 * be replaced from Dashboard → Products → Images.
 */

export type ArtKind =
  | "tshirt" | "polo" | "genji" | "panjabi" | "hoodie"
  | "shoe" | "sneaker" | "sandal" | "loafer"
  | "phone" | "earbuds" | "headphone" | "smartwatch" | "powerbank"
  | "charger" | "cable" | "mouse" | "keyboard" | "speaker" | "bulb"
  | "wallet" | "backpack" | "belt" | "cap"
  | "rice" | "dates" | "honey" | "oil" | "spice" | "tea" | "lentil" | "sugar"
  | "cookware" | "kettle" | "bottle" | "facewash";

export type Art = { kind: ArtKind; color?: string; accent?: string };

/* -------------------------------------------------------------------------- */
/* Palette                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Backgrounds are near-white with a faint tint rather than pure white: a
 * product photographed on white still has a soft floor and falloff, and a flat
 * `#fff` square reads as "missing image" at card size.
 */
const BACKDROPS = [
  ["#f5f6f8", "#e6e9ee"],
  ["#f7f5f2", "#ebe6e0"],
  ["#f4f7f7", "#e3ebeb"],
  ["#f6f5f8", "#e8e5ee"],
];

/** Lighten / darken a hex colour, for the shading on a flat fill. */
function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const nudge = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value + (amount > 0 ? (255 - value) * amount : value * amount))));
  const r = nudge(parseInt(full.slice(0, 2), 16));
  const g = nudge(parseInt(full.slice(2, 4), 16));
  const b = nudge(parseInt(full.slice(4, 6), 16));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/* -------------------------------------------------------------------------- */
/* Shape library                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Each entry draws its product inside a 0–100 box; `renderArt` scales that to
 * whatever pixel size is asked for. `c` is the product's main colour, `a` an
 * accent for straps, soles, labels and screens.
 *
 * Everything is drawn with the same three ingredients — a gradient body, a
 * translucent white highlight, and darker shading on the lower right — because
 * that is what makes a flat vector read as a lit object rather than a logo.
 */
const SHAPES: Record<ArtKind, (c: string, a: string) => string> = {
  /* ---- Clothing ---------------------------------------------------------- */
  tshirt: (c) => `
    <path d="M32 22 L42 17 Q50 24 58 17 L68 22 L78 30 L71 40 L65 36 V78 Q50 82 35 78 V36 L29 40 L22 30 Z"
          fill="url(#body)" stroke="${shade(c, -0.25)}" stroke-width="0.7"/>
    <path d="M42 17 Q50 24 58 17 L56 19 Q50 26 44 19 Z" fill="${shade(c, -0.3)}"/>
    <path d="M35 40 V78 Q42 80 50 80 V38 Z" fill="#fff" opacity="0.07"/>`,

  polo: (c, a) => `
    <path d="M32 22 L42 17 Q50 24 58 17 L68 22 L78 30 L71 40 L65 36 V78 Q50 82 35 78 V36 L29 40 L22 30 Z"
          fill="url(#body)" stroke="${shade(c, -0.25)}" stroke-width="0.7"/>
    <path d="M43 17 L50 30 L57 17 L54 16 L50 25 L46 16 Z" fill="${a}"/>
    <rect x="49.2" y="26" width="1.6" height="12" rx="0.8" fill="${shade(c, -0.35)}"/>
    <circle cx="50" cy="29" r="0.9" fill="#fff" opacity="0.8"/>
    <circle cx="50" cy="35" r="0.9" fill="#fff" opacity="0.8"/>`,

  genji: (c, a) => `
    <path d="M38 20 Q40 34 32 46 L32 78 Q50 82 68 78 L68 46 Q60 34 62 20 Q50 30 38 20 Z"
          fill="url(#body)" stroke="${shade(c, -0.25)}" stroke-width="0.7"/>
    <path d="M38 20 Q50 30 62 20" fill="none" stroke="${shade(c, -0.3)}" stroke-width="1"/>
    <path d="M32 50 L32 78 Q40 80 46 80 L46 48 Z" fill="#fff" opacity="0.08"/>
    <path d="M36 76 Q50 79 64 76" fill="none" stroke="${a}" stroke-width="0.8" opacity="0.35"/>`,

  panjabi: (c, a) => `
    <path d="M33 21 L43 16 Q50 22 57 16 L67 21 L76 31 L70 39 L65 35 V86 Q50 90 35 86 V35 L30 39 L24 31 Z"
          fill="url(#body)" stroke="${shade(c, -0.25)}" stroke-width="0.7"/>
    <rect x="49.2" y="22" width="1.6" height="34" rx="0.8" fill="${a}" opacity="0.75"/>
    <path d="M43 16 Q50 22 57 16 L55 18 Q50 24 45 18 Z" fill="${shade(c, -0.3)}"/>`,

  hoodie: (c, a) => `
    <path d="M32 26 L42 19 Q50 27 58 19 L68 26 L78 34 L71 44 L65 40 V80 Q50 84 35 80 V40 L29 44 L22 34 Z"
          fill="url(#body)" stroke="${shade(c, -0.25)}" stroke-width="0.7"/>
    <path d="M41 19 Q50 30 59 19 Q56 15 50 15 Q44 15 41 19 Z" fill="${shade(c, -0.18)}"/>
    <path d="M46 27 V33" stroke="${a}" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M54 27 V33" stroke="${a}" stroke-width="1.1" stroke-linecap="round"/>
    <rect x="40" y="58" width="20" height="12" rx="2" fill="${shade(c, -0.12)}"/>`,

  /* ---- Footwear ---------------------------------------------------------- */
  shoe: (c, a) => `
    <path d="M20 62 Q22 44 34 40 Q44 37 52 44 Q60 51 72 54 Q80 56 80 62 L80 66 Q80 70 74 70 L26 70 Q20 70 20 66 Z"
          fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.7"/>
    <path d="M20 64 L80 64 L80 66 Q80 70 74 70 L26 70 Q20 70 20 66 Z" fill="${a}"/>
    <path d="M34 41 Q40 47 45 44 M39 39 Q45 45 50 42" stroke="#fff" stroke-width="0.9" opacity="0.55" fill="none"/>
    <path d="M24 58 Q30 46 40 43" stroke="#fff" stroke-width="1.2" opacity="0.25" fill="none"/>`,

  sneaker: (c, a) => `
    <path d="M18 60 Q20 42 32 38 Q42 35 50 42 Q58 49 72 52 Q82 54 82 62 L82 65 Q82 69 76 69 L24 69 Q18 69 18 65 Z"
          fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.7"/>
    <path d="M18 62 L82 62 L82 65 Q82 69 76 69 L24 69 Q18 69 18 65 Z" fill="${a}"/>
    <path d="M18 62 L82 62" stroke="${shade(a, -0.3)}" stroke-width="0.6"/>
    <path d="M33 40 L44 50 M38 38 L49 48 M43 37 L54 47" stroke="#fff" stroke-width="1" opacity="0.6"/>
    <ellipse cx="30" cy="50" rx="7" ry="9" fill="#fff" opacity="0.12"/>`,

  sandal: (c, a) => `
    <path d="M50 14 Q60 14 62 26 Q64 34 60 48 Q57 58 58 68 Q59 80 50 82 Q41 80 42 68 Q43 58 40 48 Q36 34 38 26 Q40 14 50 14 Z"
          fill="${shade(a, 0.12)}" stroke="${shade(a, -0.35)}" stroke-width="0.8"/>
    <path d="M50 17 Q57 17 59 27 Q61 34 57 47 Q54 57 55 67 Q56 77 50 79 Q44 77 45 67 Q46 57 43 47 Q39 34 41 27 Q43 17 50 17 Z"
          fill="#fff" opacity="0.14"/>
    <path d="M50 27 L40 40" stroke="url(#stroke)" stroke-width="4" stroke-linecap="round"/>
    <path d="M50 27 L60 40" stroke="url(#stroke)" stroke-width="4" stroke-linecap="round"/>
    <circle cx="50" cy="26" r="2.4" fill="${shade(c, -0.2)}"/>
    <ellipse cx="50" cy="70" rx="5" ry="3.5" fill="${shade(a, -0.18)}" opacity="0.45"/>`,

  loafer: (c, a) => `
    <path d="M22 60 Q24 46 36 43 Q48 40 58 46 Q68 52 76 54 Q82 56 82 62 Q82 68 76 68 L28 68 Q22 68 22 62 Z"
          fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.7"/>
    <path d="M22 63 L82 63 L82 65 Q82 68 76 68 L28 68 Q22 68 22 63 Z" fill="${a}"/>
    <path d="M40 46 Q50 43 58 48" stroke="${shade(c, -0.35)}" stroke-width="1.1" fill="none"/>
    <rect x="44" y="47" width="10" height="2.6" rx="1.3" fill="${shade(c, 0.35)}"/>`,

  /* ---- Electronics ------------------------------------------------------- */
  phone: (c, a) => `
    <rect x="34" y="14" width="32" height="62" rx="5" fill="url(#body)" stroke="${shade(c, -0.35)}" stroke-width="0.8"/>
    <rect x="36.5" y="18" width="27" height="54" rx="3" fill="${a}"/>
    <rect x="36.5" y="18" width="27" height="54" rx="3" fill="url(#glass)"/>
    <rect x="45" y="16.2" width="10" height="1.6" rx="0.8" fill="${shade(c, -0.5)}"/>
    <circle cx="59" cy="24" r="2.6" fill="${shade(c, -0.45)}"/>
    <circle cx="59" cy="24" r="1.2" fill="#5b8dd6" opacity="0.8"/>`,

  earbuds: (c, a) => `
    <rect x="30" y="42" width="40" height="26" rx="8" fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <path d="M30 52 H70" stroke="${shade(c, -0.25)}" stroke-width="0.8"/>
    <circle cx="40" cy="32" r="7" fill="${shade(c, 0.15)}" stroke="${shade(c, -0.25)}" stroke-width="0.7"/>
    <path d="M40 38 Q38 46 40 50" stroke="${shade(c, 0.1)}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="60" cy="32" r="7" fill="${shade(c, 0.15)}" stroke="${shade(c, -0.25)}" stroke-width="0.7"/>
    <path d="M60 38 Q62 46 60 50" stroke="${shade(c, 0.1)}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="50" cy="62" r="1.6" fill="${a}"/>`,

  headphone: (c, a) => `
    <path d="M26 54 V42 Q26 22 50 22 Q74 22 74 42 V54" fill="none" stroke="url(#stroke)" stroke-width="6" stroke-linecap="round"/>
    <rect x="18" y="48" width="17" height="26" rx="7" fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <rect x="65" y="48" width="17" height="26" rx="7" fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <rect x="22" y="52" width="9" height="18" rx="4.5" fill="${a}"/>
    <rect x="69" y="52" width="9" height="18" rx="4.5" fill="${a}"/>`,

  smartwatch: (c, a) => `
    <path d="M42 16 H58 L60 34 H40 Z" fill="${shade(c, -0.2)}"/>
    <path d="M40 66 H60 L58 84 H42 Z" fill="${shade(c, -0.2)}"/>
    <rect x="33" y="30" width="34" height="40" rx="9" fill="url(#body)" stroke="${shade(c, -0.4)}" stroke-width="0.8"/>
    <rect x="36" y="33" width="28" height="34" rx="7" fill="${a}"/>
    <rect x="36" y="33" width="28" height="34" rx="7" fill="url(#glass)"/>
    <rect x="67" y="42" width="2.4" height="7" rx="1.2" fill="${shade(c, -0.35)}"/>
    <path d="M44 50 h5 l2 -5 l3 9 l2 -4 h5" stroke="#7fd6a8" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,

  powerbank: (c, a) => `
    <rect x="32" y="24" width="36" height="52" rx="6" fill="url(#body)" stroke="${shade(c, -0.35)}" stroke-width="0.8"/>
    <rect x="38" y="34" width="24" height="5" rx="2.5" fill="${shade(c, -0.4)}"/>
    <rect x="39" y="35" width="16" height="3" rx="1.5" fill="${a}"/>
    <circle cx="40" cy="62" r="1.6" fill="${a}"/><circle cx="46" cy="62" r="1.6" fill="${a}"/>
    <circle cx="52" cy="62" r="1.6" fill="${shade(c, -0.3)}"/><circle cx="58" cy="62" r="1.6" fill="${shade(c, -0.3)}"/>
    <rect x="44" y="47" width="12" height="8" rx="1.5" fill="${shade(c, -0.42)}"/>`,

  charger: (c, a) => `
    <rect x="36" y="30" width="28" height="30" rx="6" fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <rect x="44" y="22" width="3" height="9" rx="1.5" fill="${shade(c, -0.45)}"/>
    <rect x="53" y="22" width="3" height="9" rx="1.5" fill="${shade(c, -0.45)}"/>
    <rect x="45" y="58" width="10" height="3" rx="1.5" fill="${a}"/>
    <path d="M50 62 Q50 74 62 74" stroke="${shade(c, 0.05)}" stroke-width="3" fill="none" stroke-linecap="round"/>`,

  cable: (c, a) => `
    <path d="M24 40 Q40 26 50 44 Q60 62 76 50" stroke="url(#stroke)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="17" y="35" width="10" height="10" rx="2" fill="${a}"/>
    <rect x="73" y="45" width="10" height="10" rx="2" fill="${a}"/>
    <rect x="14" y="37" width="4" height="6" rx="1" fill="${shade(a, -0.4)}"/>`,

  mouse: (c, a) => `
    <path d="M50 24 Q68 24 68 46 V60 Q68 76 50 76 Q32 76 32 60 V46 Q32 24 50 24 Z"
          fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <path d="M50 24 V44" stroke="${shade(c, -0.25)}" stroke-width="0.8"/>
    <rect x="48.4" y="32" width="3.2" height="8" rx="1.6" fill="${a}"/>
    <ellipse cx="42" cy="38" rx="6" ry="10" fill="#fff" opacity="0.12"/>`,

  keyboard: (c, a) => `
    <rect x="14" y="36" width="72" height="30" rx="4" fill="url(#body)" stroke="${shade(c, -0.35)}" stroke-width="0.8"/>
    ${Array.from({ length: 4 }, (_, row) =>
      Array.from({ length: 11 }, (_, col) =>
        `<rect x="${17.5 + col * 6.1}" y="${39.5 + row * 6.4}" width="5" height="5" rx="1" fill="${row === 3 && col > 2 && col < 8 ? a : shade(c, 0.22)}"/>`,
      ).join(""),
    ).join("")}`,

  speaker: (c, a) => `
    <rect x="34" y="22" width="32" height="56" rx="8" fill="url(#body)" stroke="${shade(c, -0.35)}" stroke-width="0.8"/>
    <circle cx="50" cy="40" r="10" fill="${shade(c, -0.35)}"/>
    <circle cx="50" cy="40" r="5" fill="${shade(c, -0.5)}"/>
    <circle cx="50" cy="40" r="2" fill="${a}"/>
    <circle cx="50" cy="62" r="7" fill="${shade(c, -0.3)}"/>
    <circle cx="50" cy="62" r="3" fill="${shade(c, -0.45)}"/>`,

  bulb: (c, a) => `
    <path d="M50 18 Q66 18 66 36 Q66 46 58 52 V60 H42 V52 Q34 46 34 36 Q34 18 50 18 Z" fill="url(#glass2)" stroke="${shade(c, -0.2)}" stroke-width="0.7"/>
    <rect x="42" y="60" width="16" height="4" rx="1" fill="${a}"/>
    <rect x="43" y="65" width="14" height="4" rx="1" fill="${shade(a, -0.15)}"/>
    <rect x="44" y="70" width="12" height="4" rx="1.5" fill="${shade(a, -0.3)}"/>
    <path d="M45 34 Q50 44 55 34" stroke="#f4b942" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,

  /* ---- Bags and accessories ---------------------------------------------- */
  wallet: (c, a) => `
    <rect x="24" y="34" width="52" height="34" rx="5" fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <path d="M24 44 H76" stroke="${shade(c, -0.22)}" stroke-width="0.8"/>
    <rect x="56" y="46" width="20" height="12" rx="3" fill="${shade(c, -0.18)}"/>
    <circle cx="66" cy="52" r="3" fill="${a}"/>
    <path d="M28 38 H52" stroke="${shade(c, 0.3)}" stroke-width="1" opacity="0.6"/>`,

  backpack: (c, a) => `
    <path d="M32 34 Q32 22 50 22 Q68 22 68 34 V74 Q68 80 62 80 H38 Q32 80 32 74 Z"
          fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <path d="M38 22 Q38 12 50 12 Q62 12 62 22" fill="none" stroke="${shade(c, -0.25)}" stroke-width="2.5"/>
    <rect x="36" y="52" width="28" height="18" rx="4" fill="${shade(c, -0.15)}"/>
    <rect x="44" y="58" width="12" height="3" rx="1.5" fill="${a}"/>
    <path d="M32 44 H68" stroke="${a}" stroke-width="1.6" opacity="0.8"/>`,

  belt: (c, a) => `
    <path d="M18 46 H66 V58 H18 Z" fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.7"/>
    <rect x="64" y="42" width="18" height="20" rx="3" fill="none" stroke="${a}" stroke-width="3"/>
    <rect x="70" y="50" width="10" height="2" rx="1" fill="${a}"/>
    ${Array.from({ length: 5 }, (_, i) => `<circle cx="${26 + i * 7}" cy="52" r="1.4" fill="${shade(c, -0.4)}"/>`).join("")}`,

  cap: (c, a) => `
    <path d="M26 56 Q26 28 50 28 Q74 28 74 56 Z" fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <path d="M74 52 Q88 54 86 62 Q70 62 72 56 Z" fill="${shade(c, -0.15)}"/>
    <path d="M50 28 V56" stroke="${shade(c, -0.2)}" stroke-width="0.8"/>
    <circle cx="50" cy="29" r="2" fill="${a}"/>`,

  /* ---- Groceries --------------------------------------------------------- */
  rice: (c, a) => `
    <path d="M30 30 Q30 24 36 24 H64 Q70 24 70 30 V76 Q70 80 64 80 H36 Q30 80 30 76 Z"
          fill="url(#body)" stroke="${shade(c, -0.25)}" stroke-width="0.8"/>
    <path d="M34 24 Q50 18 66 24 Q58 28 50 28 Q42 28 34 24 Z" fill="${shade(c, -0.2)}"/>
    <rect x="36" y="40" width="28" height="22" rx="3" fill="#fff" opacity="0.92"/>
    <ellipse cx="50" cy="48" rx="9" ry="5" fill="${a}" opacity="0.3"/>
    ${Array.from({ length: 7 }, (_, i) =>
      `<ellipse cx="${43 + (i % 4) * 5}" cy="${46 + Math.floor(i / 4) * 5}" rx="2.2" ry="1.1" fill="#e8dcc0" stroke="#cbbb95" stroke-width="0.3" transform="rotate(${i * 25} ${43 + (i % 4) * 5} ${46 + Math.floor(i / 4) * 5})"/>`,
    ).join("")}
    <rect x="38" y="66" width="24" height="3" rx="1.5" fill="${a}" opacity="0.55"/>`,

  dates: (c, a) => `
    <path d="M24 42 H76 V72 Q76 78 70 78 H30 Q24 78 24 72 Z" fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <path d="M24 42 L30 34 H70 L76 42 Z" fill="${shade(c, -0.15)}"/>
    ${Array.from({ length: 8 }, (_, i) =>
      `<ellipse cx="${33 + (i % 4) * 11.5}" cy="${52 + Math.floor(i / 4) * 13}" rx="5" ry="7"
        fill="${i % 2 ? "#5a3620" : "#6b4126"}" stroke="#3d2415" stroke-width="0.4"
        transform="rotate(${(i * 37) % 30 - 15} ${33 + (i % 4) * 11.5} ${52 + Math.floor(i / 4) * 13})"/>
       <ellipse cx="${31.5 + (i % 4) * 11.5}" cy="${49 + Math.floor(i / 4) * 13}" rx="1.6" ry="2.4" fill="#fff" opacity="0.18"/>`,
    ).join("")}
    <rect x="34" y="36" width="32" height="4" rx="2" fill="${a}" opacity="0.7"/>`,

  honey: (c, a) => `
    <path d="M38 30 H62 V36 Q70 42 70 54 V72 Q70 78 64 78 H36 Q30 78 30 72 V54 Q30 42 38 36 Z"
          fill="url(#glass2)" stroke="${shade(c, -0.2)}" stroke-width="0.8"/>
    <path d="M33 52 Q33 44 40 40 H60 Q67 44 67 52 V70 Q67 75 62 75 H38 Q33 75 33 70 Z" fill="${c}" opacity="0.88"/>
    <rect x="36" y="24" width="28" height="8" rx="2" fill="${a}"/>
    <rect x="38" y="56" width="24" height="12" rx="2" fill="#fff" opacity="0.9"/>
    <path d="M44 62 l3 -3 l3 3 l3 -3 l3 3" stroke="${shade(a, -0.2)}" stroke-width="1.1" fill="none"/>
    <ellipse cx="40" cy="50" rx="3" ry="8" fill="#fff" opacity="0.25"/>`,

  oil: (c, a) => `
    <path d="M44 20 H56 V30 Q66 36 66 50 V72 Q66 78 60 78 H40 Q34 78 34 72 V50 Q34 36 44 30 Z"
          fill="url(#glass2)" stroke="${shade(c, -0.2)}" stroke-width="0.8"/>
    <path d="M37 52 Q37 42 45 38 H55 Q63 42 63 52 V70 Q63 75 58 75 H42 Q37 75 37 70 Z" fill="${c}" opacity="0.85"/>
    <rect x="43" y="14" width="14" height="8" rx="2" fill="${a}"/>
    <rect x="39" y="54" width="22" height="14" rx="2" fill="#fff" opacity="0.92"/>
    <path d="M44 61 h13 M44 64 h9" stroke="${shade(a, -0.1)}" stroke-width="1" stroke-linecap="round"/>
    <ellipse cx="42" cy="50" rx="2.5" ry="8" fill="#fff" opacity="0.28"/>`,

  spice: (c, a) => `
    <rect x="36" y="30" width="28" height="46" rx="4" fill="url(#glass2)" stroke="${shade(c, -0.2)}" stroke-width="0.8"/>
    <rect x="38.5" y="42" width="23" height="31" rx="3" fill="${c}" opacity="0.9"/>
    <rect x="37" y="24" width="26" height="8" rx="2" fill="${a}"/>
    <rect x="40" y="48" width="20" height="12" rx="2" fill="#fff" opacity="0.9"/>
    <ellipse cx="42" cy="52" rx="2" ry="9" fill="#fff" opacity="0.25"/>`,

  tea: (c, a) => `
    <path d="M32 28 H68 V74 Q68 79 62 79 H38 Q32 79 32 74 Z" fill="url(#body)" stroke="${shade(c, -0.3)}" stroke-width="0.8"/>
    <path d="M32 28 Q50 22 68 28 L68 32 Q50 26 32 32 Z" fill="${shade(c, -0.18)}"/>
    <circle cx="50" cy="50" r="12" fill="#fff" opacity="0.92"/>
    <path d="M44 52 Q50 40 56 52 Q50 56 44 52 Z" fill="${a}"/>
    <path d="M50 44 V54" stroke="${shade(a, -0.35)}" stroke-width="0.8"/>
    <rect x="38" y="68" width="24" height="3" rx="1.5" fill="${a}" opacity="0.6"/>`,

  lentil: (c, a) => `
    <path d="M30 34 Q30 28 36 28 H64 Q70 28 70 34 V74 Q70 79 64 79 H36 Q30 79 30 74 Z"
          fill="url(#body)" stroke="${shade(c, -0.25)}" stroke-width="0.8"/>
    <rect x="36" y="42" width="28" height="24" rx="3" fill="#fff" opacity="0.93"/>
    ${Array.from({ length: 12 }, (_, i) =>
      `<circle cx="${40 + (i % 4) * 6.7}" cy="${47 + Math.floor(i / 4) * 6.5}" r="2.4" fill="${i % 3 === 0 ? shade(a, 0.15) : a}" stroke="${shade(a, -0.25)}" stroke-width="0.3"/>`,
    ).join("")}
    <rect x="38" y="70" width="24" height="3" rx="1.5" fill="${a}" opacity="0.55"/>`,

  sugar: (c, a) => `
    <path d="M30 32 Q30 26 36 26 H64 Q70 26 70 32 V74 Q70 79 64 79 H36 Q30 79 30 74 Z"
          fill="url(#body)" stroke="${shade(c, -0.25)}" stroke-width="0.8"/>
    <rect x="36" y="42" width="28" height="22" rx="3" fill="#fff" opacity="0.94"/>
    ${Array.from({ length: 9 }, (_, i) =>
      `<rect x="${40 + (i % 3) * 7}" y="${47 + Math.floor(i / 3) * 6}" width="5" height="4" rx="0.8" fill="#f4f6f8" stroke="#cfd6dd" stroke-width="0.4"/>`,
    ).join("")}
    <rect x="38" y="68" width="24" height="3" rx="1.5" fill="${a}" opacity="0.55"/>`,

  /* ---- Home and kitchen -------------------------------------------------- */
  cookware: (c, a) => `
    <path d="M26 44 H74 V62 Q74 74 62 74 H38 Q26 74 26 62 Z" fill="url(#body)" stroke="${shade(c, -0.35)}" stroke-width="0.8"/>
    <ellipse cx="50" cy="44" rx="24" ry="6" fill="${shade(c, 0.25)}" stroke="${shade(c, -0.3)}" stroke-width="0.7"/>
    <ellipse cx="50" cy="44" rx="19" ry="4.2" fill="${shade(c, -0.35)}"/>
    <rect x="74" y="46" width="16" height="4" rx="2" fill="${a}"/>
    <rect x="10" y="46" width="16" height="4" rx="2" fill="${a}"/>
    <path d="M32 50 Q34 64 44 68" stroke="#fff" stroke-width="2" opacity="0.2" fill="none"/>`,

  kettle: (c, a) => `
    <path d="M32 40 H68 V66 Q68 76 58 76 H42 Q32 76 32 66 Z" fill="url(#body)" stroke="${shade(c, -0.35)}" stroke-width="0.8"/>
    <ellipse cx="50" cy="40" rx="18" ry="4.6" fill="${shade(c, 0.25)}"/>
    <path d="M68 46 Q80 50 80 58 Q80 64 72 64" fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="44" y="30" width="12" height="10" rx="2" fill="${a}"/>
    <rect x="36" y="52" width="5" height="18" rx="2.5" fill="#fff" opacity="0.35"/>`,

  bottle: (c, a) => `
    <path d="M44 18 H56 V28 Q64 34 64 46 V72 Q64 78 58 78 H42 Q36 78 36 72 V46 Q36 34 44 28 Z"
          fill="url(#glass2)" stroke="${shade(c, -0.2)}" stroke-width="0.8"/>
    <path d="M39 48 Q39 40 46 36 H54 Q61 40 61 48 V70 Q61 75 56 75 H44 Q39 75 39 70 Z" fill="${c}" opacity="0.55"/>
    <rect x="43" y="12" width="14" height="8" rx="2.5" fill="${a}"/>
    <rect x="40" y="52" width="20" height="10" rx="2" fill="#fff" opacity="0.85"/>
    <ellipse cx="43" cy="48" rx="2.2" ry="9" fill="#fff" opacity="0.3"/>`,

  facewash: (c, a) => `
    <path d="M42 24 H58 L62 34 V74 Q62 79 56 79 H44 Q38 79 38 74 V34 Z"
          fill="url(#body)" stroke="${shade(c, -0.25)}" stroke-width="0.8"/>
    <rect x="44" y="16" width="12" height="9" rx="2" fill="${a}"/>
    <rect x="41" y="44" width="18" height="22" rx="2.5" fill="#fff" opacity="0.92"/>
    <circle cx="50" cy="52" r="4.5" fill="${a}" opacity="0.35"/>
    <path d="M46 60 h8 M47 63 h6" stroke="${shade(a, -0.15)}" stroke-width="1" stroke-linecap="round"/>
    <ellipse cx="43" cy="42" rx="1.8" ry="7" fill="#fff" opacity="0.3"/>`,
};

/* -------------------------------------------------------------------------- */
/* Renderer                                                                    */
/* -------------------------------------------------------------------------- */

/** Which shapes are see-through, so the backdrop shows through the body. */
const GLASSY = new Set<ArtKind>(["honey", "oil", "spice", "bottle", "bulb"]);

/** Gradient ids the shapes reference. Suffixed per instance so a scene can hold several. */
const GRADIENT_IDS = ["bg", "body", "stroke", "glass", "glass2", "shadow"] as const;

/**
 * The defs and the drawing for one product, with every gradient id suffixed.
 *
 * SVG ids are document-global, so two products in one picture would otherwise
 * share the first one's body gradient and come out the same colour.
 */
function artParts(art: Art, index: number, suffix = ""): { defs: string; body: string } {
  const color = art.color ?? "#4b5563";
  const accent = art.accent ?? shade(color, -0.45);
  const [bgFrom, bgTo] = BACKDROPS[index % BACKDROPS.length]!;
  const raw = `${defsFor(color, bgFrom, bgTo)}\u0000${SHAPES[art.kind](color, accent)}`;

  const namespaced = suffix
    ? GRADIENT_IDS.reduce(
        (svg, id) =>
          svg.replaceAll(`id="${id}"`, `id="${id}${suffix}"`).replaceAll(`url(#${id})`, `url(#${id}${suffix})`),
        raw,
      )
    : raw;

  const [defs, body] = namespaced.split("\u0000");
  return { defs: defs!, body: body! };
}

function defsFor(color: string, bgFrom: string, bgTo: string): string {
  return `
    <radialGradient id="bg" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="${bgFrom}"/>
      <stop offset="100%" stop-color="${bgTo}"/>
    </radialGradient>
    <linearGradient id="body" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="${shade(color, 0.28)}"/>
      <stop offset="45%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${shade(color, -0.3)}"/>
    </linearGradient>
    <linearGradient id="stroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${shade(color, 0.2)}"/>
      <stop offset="100%" stop-color="${shade(color, -0.28)}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="42%" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.12"/>
    </linearGradient>
    <linearGradient id="glass2" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#eef1f4" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#d6dbe1" stop-opacity="0.75"/>
    </linearGradient>
    <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1b2129" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#1b2129" stop-opacity="0"/>
    </radialGradient>
`;
}

/** One product, drawn on its own backdrop — the image on a product card. */
export function artSvg(art: Art, size: number, index = 0): string {
  const { defs, body } = artParts(art, index);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>${defs}</defs>
  <rect width="100" height="100" fill="url(#bg)"/>
  <!-- The contact shadow is what stops the object floating in a flat square. -->
  <ellipse cx="50" cy="${GLASSY.has(art.kind) ? 80 : 78}" rx="27" ry="5.5" fill="url(#shadow)"/>
  ${body}
</svg>`;
}

/**
 * A wide banner: several products grouped on a tinted ground.
 *
 * Banners sit behind copy the page draws on top — the hero at 35% opacity, the
 * two side cards with the title over the bottom-left corner — so the products
 * are pushed to the right and the ground stays pale. A single stretched square
 * would crop to a meaningless close-up at these aspect ratios.
 */
export function sceneSvg(items: Art[], width: number, height: number, tint = "#e7ecf2"): string {
  const parts = items.map((art, index) => artParts(art, index, `-s${index}`));

  // The viewBox keeps the banner's real aspect ratio, so the products inside it
  // are never stretched — a squashed shoe is worse than no picture at all.
  const vh = 100;
  const vw = Math.round((vh * width) / height);

  // Copy occupies the left; the group sits in the right of the banner.
  const zoneStart = vw * 0.36;
  const zoneWidth = vw * 0.60;
  const count = Math.max(items.length, 1);
  const step = zoneWidth / count;

  // Every shape is drawn between roughly x=20 and x=80 of its own box, so a
  // cell of `step` holds a product `step / 0.6` wide. Capped against the
  // banner's height so a two-item scene does not grow past the frame.
  const side = Math.min(vh * 0.68, step / 0.55);

  // One floor for all of them. Objects sitting at different heights read as
  // floating clip art; a shared baseline plus a shadow under each is what makes
  // the group look photographed on a table.
  const baseline = vh * 0.82;
  const bodyBottom = 82;

  const placed = parts.map((part, index) => {
    const scale = (side / 100) * (index % 2 === 0 ? 1 : 0.86);
    const centre = zoneStart + index * step + step / 2;
    const x = centre - 50 * scale;
    const y = baseline - bodyBottom * scale;
    return { part, index, scale, centre, x, y };
  });

  const shadows = placed.map(
    ({ index, scale, centre }) =>
      `  <ellipse cx="${centre.toFixed(1)}" cy="${baseline.toFixed(1)}" rx="${(27 * scale).toFixed(1)}"` +
      ` ry="${(5 * scale).toFixed(1)}" fill="url(#shadow-s${index})"/>`,
  );

  const groups = placed.map(
    ({ part, scale, x, y }) =>
      `  <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})">${part.body}</g>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${vw} ${vh}">
  <defs>
    <linearGradient id="ground" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${shade(tint, 0.5)}"/>
      <stop offset="100%" stop-color="${shade(tint, -0.12)}"/>
    </linearGradient>
${parts.map((part) => part.defs).join("\n")}
  </defs>
  <rect width="${vw}" height="${vh}" fill="url(#ground)"/>
${shadows.join("\n")}
${groups.join("\n")}
</svg>`;
}

