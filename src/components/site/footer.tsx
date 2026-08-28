import Link from "next/link";

import { getSettings } from "@/lib/settings";
import { getSiteNavigation, type NavNode } from "@/lib/services/navigation";

function FooterColumn({ title, items }: { title: string; items: NavNode[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold text-brand-950">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="text-sm text-brand-600 hover:text-brand-900 hover:underline underline-offset-4"
              target={item.openInNewTab ? "_blank" : undefined}
              rel={item.openInNewTab ? "noopener noreferrer" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SOCIAL_LABELS: Array<[keyof Awaited<ReturnType<typeof getSettings>>["social"], string]> = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"],
  ["whatsapp", "WhatsApp"],
];

export async function SiteFooter() {
  const [settings, navigation] = await Promise.all([getSettings(), getSiteNavigation()]);
  const socials = SOCIAL_LABELS.filter(([key]) => settings.social[key]);

  return (
    <footer className="mt-12 border-t border-line bg-white">
      <div className="tm-container py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-lg font-extrabold tracking-tight text-brand-950">{settings.site.siteName}</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-brand-600">{settings.site.footerAbout}</p>

            <dl className="mt-4 space-y-1.5 text-sm text-brand-600">
              {settings.contact.phone ? (
                <div className="flex gap-2">
                  <dt className="font-semibold text-brand-800">Phone</dt>
                  <dd><a className="hover:underline" href={`tel:${settings.contact.phone}`}>{settings.contact.phone}</a></dd>
                </div>
              ) : null}
              {settings.contact.email ? (
                <div className="flex gap-2">
                  <dt className="font-semibold text-brand-800">Email</dt>
                  <dd><a className="hover:underline" href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a></dd>
                </div>
              ) : null}
              {settings.contact.address ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-brand-800">Address</dt>
                  <dd>{settings.contact.address}</dd>
                </div>
              ) : null}
              {settings.contact.workingHours ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-brand-800">Hours</dt>
                  <dd>{settings.contact.workingHours}</dd>
                </div>
              ) : null}
            </dl>

            {socials.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {socials.map(([key, label]) => (
                  <a
                    key={key}
                    href={settings.social[key]}
                    className="chip"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <FooterColumn title="Shop" items={navigation.footerShop} />
          <FooterColumn title="Help" items={navigation.footerHelp} />
          <FooterColumn title="Company" items={navigation.footerCompany} />
        </div>
      </div>

      <div className="border-t border-line">
        <div className="tm-container flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-brand-500">
          <p>{settings.site.copyright}</p>
          <p className="flex flex-wrap items-center gap-3">
            <Link href="/terms" className="hover:text-brand-900">Terms</Link>
            <Link href="/privacy" className="hover:text-brand-900">Privacy</Link>
            <Link href="/refund-policy" className="hover:text-brand-900">Refund policy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
