import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumb, EmptyState, JsonLd } from "@/components/ui";
import { prisma, safeQuery } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildMetadata, faqJsonLd } from "@/lib/seo";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, {
    title: "Frequently asked questions",
    description: `Answers about ordering, delivery, payment and returns at ${settings.site.siteName}.`,
    path: "/faq",
  });
}

/** AEO-friendly: real question/answer structure plus FAQPage JSON-LD. */
export default async function FaqPage() {
  const faqs = await safeQuery(
    () =>
      prisma.faq.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { position: "asc" }],
        select: { id: true, question: true, answer: true, category: true },
      }),
    [] as Array<{ id: string; question: string; answer: string; category: string }>,
    "faqPage",
  );

  const grouped = faqs.reduce<Record<string, typeof faqs>>((acc, faq) => {
    (acc[faq.category] ||= []).push(faq);
    return acc;
  }, {});

  return (
    <div className="tm-container-narrow section">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "FAQ" }]} />
      <h1 className="page-title mt-3">Frequently asked questions</h1>
      <p className="page-desc mb-6">
        Can’t find what you need? <Link href="/contact" className="link">Message our support team</Link>.
      </p>

      {faqs.length === 0 ? (
        <EmptyState title="No questions published yet" description="Please check back soon." />
      ) : (
        <div className="stack">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category} className="card">
              <div className="card-header"><h2 className="card-title">{category}</h2></div>
              <div className="card-body space-y-2">
                {items.map((faq) => (
                  <details key={faq.id} className="group rounded-[var(--radius-tm)] border border-line p-3 open:bg-surface-muted">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-brand-900 marker:hidden">
                      <span className="flex items-start justify-between gap-3">
                        {faq.question}
                        <span className="shrink-0 text-brand-400 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                      </span>
                    </summary>
                    <div className="cms-content mt-2 text-sm" dangerouslySetInnerHTML={{ __html: faq.answer }} />
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {faqs.length > 0 ? <JsonLd data={faqJsonLd(faqs)} /> : null}
    </div>
  );
}
