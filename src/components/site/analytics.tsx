"use client";

import Script from "next/script";
import { useCallback, useSyncExternalStore } from "react";

/**
 * GA4, Google Tag Manager and Meta Pixel are configured from the dashboard —
 * no source-code edit is needed to change an ID (PRD §22).
 *
 * When "require consent" is on nothing loads until the visitor accepts, and no
 * personal data is ever pushed into the data layer.
 */

export type AnalyticsConfig = {
  ga4MeasurementId: string;
  gtmContainerId: string;
  metaPixelId: string;
  requireConsent: boolean;
  consentText: string;
};

const CONSENT_KEY = "tm_consent";
const CONSENT_EVENT = "tm:consent-change";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
  }
}

/** Subscribes to the stored consent decision — an external store, not React state. */
function subscribeToConsent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CONSENT_EVENT, onChange);
  };
}

function readConsent(): "granted" | "denied" | null {
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    // Private mode or storage disabled — treat as "not decided yet".
    return null;
  }
}

export function AnalyticsScripts({ config }: { config: AnalyticsConfig }) {
  const decision = useSyncExternalStore(
    subscribeToConsent,
    readConsent,
    // On the server nothing is loaded and no banner is rendered.
    () => null,
  );

  const consented = config.requireConsent ? decision === "granted" : true;
  const decided = config.requireConsent ? decision !== null : true;

  const decide = useCallback((granted: boolean) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
    } catch {
      // Storage unavailable — the choice applies for this page view only.
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }, []);

  const hasAnything = config.ga4MeasurementId || config.gtmContainerId || config.metaPixelId;
  if (!hasAnything) return null;

  return (
    <>
      {consented ? (
        <>
          {config.gtmContainerId ? (
            <Script id="tm-gtm" strategy="afterInteractive">
              {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${config.gtmContainerId}');`}
            </Script>
          ) : null}

          {config.ga4MeasurementId ? (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4MeasurementId}`}
                strategy="afterInteractive"
              />
              <Script id="tm-ga4" strategy="afterInteractive">
                {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;gtag('js',new Date());gtag('config','${config.ga4MeasurementId}',{send_page_view:true});`}
              </Script>
            </>
          ) : null}

          {config.metaPixelId ? (
            <Script id="tm-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');fbq('init','${config.metaPixelId}');fbq('track','PageView');`}
            </Script>
          ) : null}
        </>
      ) : null}

      {config.requireConsent && !decided ? (
        <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl no-print">
          <div className="card flex flex-wrap items-center gap-3 p-4 shadow-[var(--shadow-tm-lg)]">
            <p className="min-w-0 flex-1 text-sm text-brand-700">{config.consentText}</p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost btn-sm" onClick={() => decide(false)}>Decline</button>
              <button type="button" className="btn-primary btn-sm" onClick={() => decide(true)}>Accept</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Event helpers                                                               */
/* -------------------------------------------------------------------------- */

type EcommerceItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
  item_category?: string;
};

/** Sends an e-commerce event to whichever providers are loaded. */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer?.push({ event: name, ...params });
    window.gtag?.("event", name, params);
    const pixelName = PIXEL_EVENT_MAP[name];
    if (pixelName) window.fbq?.("track", pixelName, params);
  } catch {
    // Analytics must never break the shopping experience.
  }
}

const PIXEL_EVENT_MAP: Record<string, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
  search: "Search",
  sign_up: "CompleteRegistration",
};

export function trackViewItem(item: EcommerceItem): void {
  trackEvent("view_item", { currency: "BDT", value: item.price, items: [item] });
}

export function trackPurchase(orderNumber: string, value: number, items: EcommerceItem[]): void {
  trackEvent("purchase", { transaction_id: orderNumber, currency: "BDT", value, items });
}
