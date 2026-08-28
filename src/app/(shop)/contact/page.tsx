import type { Metadata } from "next";

import { Breadcrumb } from "@/components/ui";
import { ContactForm } from "@/components/site/contact-form";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, {
    title: "Contact us",
    description: `Contact ${settings.site.siteName} — phone, email and support form.`,
    path: "/contact",
  });
}

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <div className="tm-container section">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
      <h1 className="page-title mt-3 mb-6">Contact us</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ContactForm />

        <aside className="stack">
          <div className="card">
            <div className="card-header"><h2 className="card-title">Reach us directly</h2></div>
            <div className="card-body space-y-3 text-sm">
              <div>
                <p className="stat-label">Phone</p>
                <a className="link" href={`tel:${settings.contact.phone}`}>{settings.contact.phone}</a>
                {settings.contact.altPhone ? (
                  <>
                    <br />
                    <a className="link" href={`tel:${settings.contact.altPhone}`}>{settings.contact.altPhone}</a>
                  </>
                ) : null}
              </div>
              <div>
                <p className="stat-label">Email</p>
                <a className="link" href={`mailto:${settings.contact.supportEmail || settings.contact.email}`}>
                  {settings.contact.supportEmail || settings.contact.email}
                </a>
              </div>
              <div>
                <p className="stat-label">Address</p>
                <p className="text-brand-600">{settings.contact.address}</p>
              </div>
              <div>
                <p className="stat-label">Hours</p>
                <p className="text-brand-600">{settings.contact.workingHours}</p>
              </div>
            </div>
          </div>

          {settings.contact.mapEmbedUrl ? (
            <div className="card overflow-hidden">
              <iframe
                src={settings.contact.mapEmbedUrl}
                title="Our location"
                className="h-64 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
