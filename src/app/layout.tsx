import type { Metadata, Viewport } from "next";

import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { FontStylesheet } from "@/components/site/font-stylesheet";
import { FONT_QUERIES, ThemeTokens } from "@/components/site/theme-tokens";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#23272d",
};

/** Site-wide defaults; every page may override them. */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const base = buildMetadata(settings.seo, { path: "/" });
  return {
    ...base,
    title: { default: settings.seo.defaultTitle, template: settings.seo.titleTemplate },
    applicationName: settings.site.siteName,
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    icons: settings.site.faviconUrl ? { icon: settings.site.faviconUrl } : undefined,
    formatDetection: { telephone: false },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Colours and font come from Business settings, applied as design tokens.
  const settings = await getSettings();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Latin + Bengali web fonts. If they fail to load the CSS font stack
            in globals.css keeps the page fully readable. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <ThemeTokens theme={settings.theme} />
        <FontStylesheet query={FONT_QUERIES[settings.theme.fontFamily]} />
        <noscript>
          <link
            rel="stylesheet"
            href={`https://fonts.googleapis.com/css2?${FONT_QUERIES[settings.theme.fontFamily]}&display=swap`}
          />
        </noscript>
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
