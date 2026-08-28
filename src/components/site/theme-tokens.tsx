import type { ThemeSettings } from "@/lib/settings-defaults";

/**
 * Applies the shop's chosen colours and font by overriding design tokens.
 *
 * The whole design system already reads from `--color-brand-*` and
 * `--font-sans`, so re-pointing those variables re-skins every button, badge
 * and heading at once — no component knows a theme exists.
 *
 * Choices are a fixed set rather than free-form values, so a shop owner
 * cannot pick a colour that leaves white text unreadable.
 */

const PALETTES = {
  graphite: {
    50: "#f6f7f8", 100: "#eceef0", 200: "#d5d9de", 300: "#b1b9c1", 400: "#86919d",
    500: "#67727f", 600: "#525c68", 700: "#434b55", 800: "#3a4049", 900: "#23272d", 950: "#14171b",
  },
  navy: {
    50: "#eef2fb", 100: "#d8e1f5", 200: "#b3c4ea", 300: "#7f9bd9", 400: "#4f70c0",
    500: "#2f4da3", 600: "#1f3a8a", 700: "#1a2f6f", 800: "#16265a", 900: "#101b3f", 950: "#0a1229",
  },
  accent: {
    50: "#fff8ed", 100: "#ffefd4", 200: "#ffdba8", 300: "#ffc071", 400: "#ff9c38",
    500: "#fd7f12", 600: "#ee6408", 700: "#c54a09", 800: "#9c3a10", 900: "#7e3210", 950: "#5d260c",
  },
} as const;

/**
 * Each pairing keeps a Bengali-capable face in the stack, so Bangla text
 * never falls back to something that cannot render it.
 */
const FONTS = {
  inter: `"Inter", "Hind Siliguri", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", "SolaimanLipi", Arial, sans-serif`,
  manrope: `"Manrope", "Hind Siliguri", ui-sans-serif, system-ui, "Segoe UI", Roboto, "Noto Sans Bengali", "SolaimanLipi", Arial, sans-serif`,
  notoSans: `"Noto Sans", "Noto Sans Bengali", "Hind Siliguri", ui-sans-serif, system-ui, "Segoe UI", Roboto, "SolaimanLipi", Arial, sans-serif`,
} as const;

/** Google Fonts families to request for each pairing. */
export const FONT_QUERIES: Record<ThemeSettings["fontFamily"], string> = {
  inter: "family=Inter:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700",
  manrope: "family=Manrope:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700",
  notoSans: "family=Noto+Sans:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700",
};

export function ThemeTokens({ theme }: { theme: ThemeSettings }) {
  const primary = PALETTES[theme.primaryColor] ?? PALETTES.graphite;
  const secondary = PALETTES[theme.secondaryColor] ?? PALETTES.navy;
  const font = FONTS[theme.fontFamily] ?? FONTS.inter;

  const declarations = [
    ...Object.entries(primary).map(([step, value]) => `--color-brand-${step}:${value};`),
    ...Object.entries(secondary).map(([step, value]) => `--color-secondary-${step}:${value};`),
    `--font-sans:${font};`,
    `--font-display:${font};`,
  ].join("");

  // A style element rather than an inline style attribute, so the variables
  // land on :root and cascade to portals and dialogs too.
  return <style>{`:root{${declarations}}`}</style>;
}
