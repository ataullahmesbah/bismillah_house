import "server-only";

import { cache } from "react";

import { prisma, safeQuery } from "@/lib/db";

/**
 * Navigation is fully database-driven (PRD §8) — the header, mega menu and
 * footer columns are all editable from the Super Admin dashboard.
 */

export type NavNode = {
  id: string;
  label: string;
  href: string;
  description: string | null;
  imageUrl: string | null;
  iconName: string | null;
  badgeText: string | null;
  openInNewTab: boolean;
  isMegaColumn: boolean;
  children: NavNode[];
};

export const MENU_KEYS = {
  MAIN: "MAIN",
  TOP_BAR: "TOP_BAR",
  FOOTER_SHOP: "FOOTER_SHOP",
  FOOTER_HELP: "FOOTER_HELP",
  FOOTER_COMPANY: "FOOTER_COMPANY",
} as const;

function resolveHref(item: {
  type: string;
  url: string | null;
  category: { slug: string } | null;
  page: { slug: string } | null;
}): string {
  switch (item.type) {
    case "CATEGORY":
      return item.category ? `/category/${item.category.slug}` : "/shop";
    case "PAGE":
      return item.page ? `/${item.page.slug}` : "/";
    case "EXTERNAL":
    case "INTERNAL":
    default:
      return item.url ?? "/";
  }
}

/** Loads one menu as a two-level tree. */
export const getMenu = cache(async (key: string): Promise<NavNode[]> => {
  const items = await safeQuery(() => prisma.navigationItem.findMany({
    where: { menu: { key }, isActive: true },
    orderBy: [{ position: "asc" }, { label: "asc" }],
    select: {
      id: true, label: true, type: true, url: true, parentId: true,
      description: true, imageUrl: true, iconName: true, badgeText: true,
      openInNewTab: true, isMegaColumn: true,
      category: { select: { slug: true } },
      page: { select: { slug: true } },
    },
  }), [], `menu:${key}`);

  const nodes = new Map<string, NavNode>();
  for (const item of items) {
    nodes.set(item.id, {
      id: item.id,
      label: item.label,
      href: resolveHref(item),
      description: item.description,
      imageUrl: item.imageUrl,
      iconName: item.iconName,
      badgeText: item.badgeText,
      openInNewTab: item.openInNewTab,
      isMegaColumn: item.isMegaColumn,
      children: [],
    });
  }

  const roots: NavNode[] = [];
  for (const item of items) {
    const node = nodes.get(item.id);
    if (!node) continue;
    if (item.parentId) {
      nodes.get(item.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
});

/** Everything the site header and footer need, in one pass. */
export const getSiteNavigation = cache(async () => {
  const [main, footerShop, footerHelp, footerCompany] = await Promise.all([
    getMenu(MENU_KEYS.MAIN),
    getMenu(MENU_KEYS.FOOTER_SHOP),
    getMenu(MENU_KEYS.FOOTER_HELP),
    getMenu(MENU_KEYS.FOOTER_COMPANY),
  ]);
  return { main, footerShop, footerHelp, footerCompany };
});

/** Active banners for a placement, respecting the schedule window. */
export const getBanners = cache(async (placement: string, limit = 6) => {
  const now = new Date();
  return safeQuery(() => prisma.banner.findMany({
    where: {
      placement: placement as never,
      isActive: true,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gt: now } }] },
      ],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true, title: true, subtitle: true, imageUrl: true, mobileImageUrl: true,
      alt: true, linkUrl: true, ctaLabel: true, secondaryLinkUrl: true, secondaryCtaLabel: true,
      htmlContent: true, frequencyHours: true,
    },
  }), [], `banners:${placement}`);
});
