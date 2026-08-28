import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { SetupNotice } from "@/components/site/setup-notice";
import { AnalyticsScripts } from "@/components/site/analytics";
import { PopupAd } from "@/components/site/popup-ad";
import { WhatsAppButton } from "@/components/site/whatsapp-button";
import { getSettings } from "@/lib/settings";
import { getBanners } from "@/lib/services/navigation";
import { JsonLd } from "@/components/ui";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const popups = settings.features.popupAdsEnabled ? await getBanners("POPUP", 1) : [];
  const popup = popups[0];

  if (settings.features.maintenanceMode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl shadow-slate-200/40 backdrop-blur-sm transition-all duration-300 sm:p-8 md:p-10">

          {/* Warning Icon - Red with pulse effect */}
          <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 shadow-lg shadow-red-100/50 sm:h-20 sm:w-20 md:mb-6">
            <div className="absolute inset-0 rounded-full bg-red-400/20 animate-ping"></div>
            <svg
              className="relative h-8 w-8 text-red-500 drop-shadow-sm sm:h-10 sm:w-10"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          {/* Headline */}
          <h1 className="text-center text-xl font-bold tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
            Maintenance Mode
          </h1>

          {/* Divider */}
          <div className="mx-auto mt-2 h-0.5 w-12 bg-gradient-to-r from-transparent via-red-300 to-transparent sm:mt-3 sm:w-16"></div>

          {/* Message */}
          <div className="mt-4 space-y-2 text-center sm:mt-5 sm:space-y-3">
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              <span className="font-semibold text-slate-700">{settings.site.siteName}</span> is currently under maintenance
            </p>

            <div className="inline-block rounded-full bg-amber-50 px-4 py-1.5 border border-amber-200/50">
              <p className="text-xs font-medium text-amber-600 sm:text-sm">
                ⚡ Orders & purchases temporarily unavailable
              </p>
            </div>

            <p className="text-sm text-slate-500 sm:text-base">
              We'll be back online shortly
            </p>
          </div>

          {/* Contact Information - Phone Number Display */}
          {settings.contact.phone && (
            <div className="mt-6 space-y-3 sm:mt-7">
              <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50/80 px-4 py-3 border border-slate-200/50">
                <svg
                  className="h-4 w-4 text-slate-400 flex-shrink-0 sm:h-5 sm:w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                  />
                </svg>
                <span className="text-sm font-medium text-slate-700 sm:text-base">
                  {settings.contact.phone}
                </span>
              </div>

              <a
                href={`tel:${settings.contact.phone}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-slate-800/20 transition-all duration-200 hover:bg-slate-700 hover:shadow-slate-800/30 hover:scale-[1.02] active:scale-[0.98] sm:py-3.5 sm:text-base"
              >
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                  />
                </svg>
                Call Now
              </a>
            </div>
          )}

          {/* Status indicator */}
          <div className="mt-5 flex items-center justify-center gap-2 text-center">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
            </span>
            <span className="text-xs text-slate-400 sm:text-sm">
              We're working on it • Back soon
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <SetupNotice />
        {children}
      </main>
      <SiteFooter />
      <WhatsAppButton value={settings.social.whatsapp} shopName={settings.site.siteName} />

      <JsonLd
        data={[
          organizationJsonLd(settings.seo, {
            phone: settings.contact.phone,
            email: settings.contact.email,
            address: settings.contact.address,
          }),
          websiteJsonLd(settings.seo),
        ]}
      />

      <AnalyticsScripts
        config={{
          ga4MeasurementId: settings.analytics.ga4MeasurementId,
          gtmContainerId: settings.analytics.gtmContainerId,
          metaPixelId: settings.analytics.metaPixelId,
          requireConsent: settings.analytics.requireConsent,
          consentText: settings.analytics.consentText,
        }}
      />

      {popup ? (
        <PopupAd
          banner={{
            id: popup.id,
            title: popup.title,
            subtitle: popup.subtitle,
            imageUrl: popup.imageUrl,
            linkUrl: popup.linkUrl,
            ctaLabel: popup.ctaLabel,
            htmlContent: popup.htmlContent,
            frequencyHours: popup.frequencyHours,
          }}
        />
      ) : null}
    </div>
  );
}