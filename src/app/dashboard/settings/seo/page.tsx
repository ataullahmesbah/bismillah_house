import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import { Field, PageHeader } from "@/components/ui";
import { saveSeoSettingsAction } from "@/app/actions/dashboard/settings";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function SeoSettingsPage() {
  await requirePermissionPage(PERMISSIONS.SEO_MANAGE);
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="SEO / GEO / AEO"
        description="Global defaults for search engines, answer engines and local discovery. Every product, category and page can override them."
      />

      <div className="alert-neutral mb-4">
        <div>
          Live endpoints:{" "}
          <a className="link" href="/sitemap.xml" target="_blank" rel="noopener noreferrer">/sitemap.xml</a>,{" "}
          <a className="link" href="/robots.txt" target="_blank" rel="noopener noreferrer">/robots.txt</a>. Both are
          generated from the database — no file to edit.
        </div>
      </div>

      <ActionForm action={saveSeoSettingsAction} className="stack">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Search defaults</h2></div>
          <div className="card-body stack">
            <Field label="Default page title" htmlFor="defaultTitle" required>
              <input id="defaultTitle" name="defaultTitle" className="input" defaultValue={settings.seo.defaultTitle} required maxLength={200} />
            </Field>
            <Field label="Title template" htmlFor="titleTemplate" hint="%s is replaced by the page title.">
              <input id="titleTemplate" name="titleTemplate" className="input" defaultValue={settings.seo.titleTemplate} maxLength={100} />
            </Field>
            <Field label="Default meta description" htmlFor="defaultDescription">
              <textarea id="defaultDescription" name="defaultDescription" className="textarea min-h-20" defaultValue={settings.seo.defaultDescription} maxLength={400} />
            </Field>
            <Field label="Keywords" htmlFor="keywords" hint="Comma separated. Minor ranking factor — keep it honest.">
              <input id="keywords" name="keywords" className="input" defaultValue={settings.seo.keywords} maxLength={500} />
            </Field>
            <ImageUploadField
              name="defaultOgImage"
              label="Default social share image"
              defaultValue={settings.seo.defaultOgImage ?? ""}
              folder="site"
              recommendation="1200 × 630 px"
              maxSizeMb={settings.upload.maxFileSizeMb}
            />
            <label className="check-row">
              <input type="checkbox" name="robotsIndex" className="checkbox mt-0.5" defaultChecked={settings.seo.robotsIndex} />
              <span className="min-w-0">
                <span className="block font-semibold">Allow search engines to index the shop</span>
                <span className="block text-xs text-brand-500">
                  Turn this off while you are still setting up. Cart, checkout and account pages are never indexed.
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Organisation (structured data)</h2>
            <span className="muted-xs">Feeds Organization &amp; WebSite JSON-LD</span>
          </div>
          <div className="card-body stack">
            <div className="grid-form-2">
              <Field label="Organisation name" htmlFor="organizationName">
                <input id="organizationName" name="organizationName" className="input" defaultValue={settings.seo.organizationName} maxLength={120} />
              </Field>
              <Field label="Organisation logo URL" htmlFor="organizationLogo">
                <input id="organizationLogo" name="organizationLogo" className="input" defaultValue={settings.seo.organizationLogo ?? ""} maxLength={2048} />
              </Field>
            </div>
            <Field
              label="Official profiles (sameAs)"
              htmlFor="organizationSameAs"
              hint="One URL per line — Facebook page, Wikipedia entry, LinkedIn, etc."
            >
              <textarea id="organizationSameAs" name="organizationSameAs" className="textarea min-h-20 font-mono text-xs" defaultValue={settings.seo.organizationSameAs} maxLength={2000} />
            </Field>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">GEO — local discovery</h2>
            <span className="muted-xs">Emitted as geo meta tags</span>
          </div>
          <div className="card-body grid-form-2">
            <Field label="Region code" htmlFor="geoRegion" hint="ISO 3166-2, e.g. BD-13 for Dhaka.">
              <input id="geoRegion" name="geoRegion" className="input" defaultValue={settings.seo.geoRegion} maxLength={20} />
            </Field>
            <Field label="Place name" htmlFor="geoPlacename">
              <input id="geoPlacename" name="geoPlacename" className="input" defaultValue={settings.seo.geoPlacename} maxLength={80} />
            </Field>
            <Field label="Latitude" htmlFor="geoLatitude">
              <input id="geoLatitude" name="geoLatitude" className="input" defaultValue={settings.seo.geoLatitude} maxLength={20} />
            </Field>
            <Field label="Longitude" htmlFor="geoLongitude">
              <input id="geoLongitude" name="geoLongitude" className="input" defaultValue={settings.seo.geoLongitude} maxLength={20} />
            </Field>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">AEO — answer engines</h2></div>
          <div className="card-body">
            <p className="text-sm text-brand-600">
              Question-and-answer content is what answer engines quote. Trust Mart emits <strong>FAQPage</strong>{" "}
              JSON-LD from your published FAQ entries and <strong>Product</strong>, <strong>Offer</strong>,{" "}
              <strong>BreadcrumbList</strong> and <strong>AggregateRating</strong> (only when real reviews exist)
              on product pages. Keep the FAQ answers factual and specific — that is the whole AEO lever.
            </p>
            <Link href="/dashboard/content/faq" className="btn-secondary btn-sm mt-3">Manage FAQ entries</Link>
          </div>
        </section>

        <div className="card">
          <div className="card-footer">
            <p className="muted-xs mr-auto">Canonical base URL: {absoluteUrl("/")}</p>
            <SubmitButton>Save SEO settings</SubmitButton>
          </div>
        </div>
      </ActionForm>
    </>
  );
}
