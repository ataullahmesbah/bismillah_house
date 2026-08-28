import type { MetadataRoute } from "next";

import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

/**
 * Generated from the dashboard SEO switch. Private and duplicate-content
 * surfaces are always excluded, whether indexing is on or off.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSettings();

  if (!settings.seo.robotsIndex) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/account",
          "/account/",
          "/cart",
          "/checkout",
          "/order-confirmation/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/search?",
          "/shop?",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
