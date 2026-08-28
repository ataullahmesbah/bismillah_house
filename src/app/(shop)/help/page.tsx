import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumb } from "@/components/ui";
import { prisma, safeQuery } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, {
    title: "Help centre",
    description: `Get help with orders, delivery, payments and returns at ${settings.site.siteName}.`,
    path: "/help",
  });
}

const QUICK_LINKS = [
  { href: "/track-order", title: "Track an order", text: "See where your parcel is right now." },
  { href: "/shipping", title: "Shipping & delivery", text: "Charges, districts and delivery times." },
  { href: "/returns", title: "Returns", text: "How to return or exchange an item." },
  { href: "/refund-policy", title: "Refunds", text: "When and how refunds are issued." },
  { href: "/faq", title: "FAQ", text: "Quick answers to common questions." },
  { href: "/contact", title: "Contact support", text: "Message our team directly." },
];

export default async function HelpPage() {
  const [settings, pages] = await Promise.all([
    getSettings(),
    safeQuery(
      () =>
        prisma.page.findMany({
          where: { isPublished: true, type: { in: ["HELP", "POLICY"] } },
          orderBy: { position: "asc" },
          select: { id: true, slug: true, title: true, excerpt: true },
        }),
      [] as Array<{ id: string; slug: string; title: string; excerpt: string | null }>,
      "helpPages",
    ),
  ]);

  return (
    <div className="tm-container section">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Help centre" }]} />
      <h1 className="page-title mt-3">Help centre</h1>
      <p className="page-desc mb-6">
        Reach us on <a className="link" href={`tel:${settings.contact.phone}`}>{settings.contact.phone}</a>{" "}
        · {settings.contact.workingHours}
      </p>

      <div className="grid-cards">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="card-hover p-5">
            <p className="text-base font-bold text-brand-950">{link.title}</p>
            <p className="mt-1 text-sm text-brand-600">{link.text}</p>
            <span className="btn-link mt-3">Open →</span>
          </Link>
        ))}
      </div>

      {pages.length > 0 ? (
        <section className="mt-10">
          <h2 className="section-title mb-4">All help & policy pages</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pages.map((page) => (
              <Link key={page.id} href={`/${page.slug}`} className="card-hover p-4">
                <p className="text-sm font-semibold text-brand-900">{page.title}</p>
                {page.excerpt ? <p className="mt-1 text-xs text-brand-500">{page.excerpt}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
