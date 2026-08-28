"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export type PopupBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
  htmlContent: string | null;
  frequencyHours: number;
};

/**
 * Promotional popup with a frequency cap so a returning visitor is not shown
 * the same modal on every page view (PRD §14).
 */
export function PopupAd({ banner }: { banner: PopupBanner }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `tm_popup_${banner.id}`;
    let lastSeen = 0;
    try { lastSeen = Number(window.localStorage.getItem(key) ?? 0); } catch { lastSeen = 0; }

    const capMs = banner.frequencyHours * 60 * 60 * 1000;
    if (capMs > 0 && lastSeen && Date.now() - lastSeen < capMs) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
      try { window.localStorage.setItem(key, String(Date.now())); } catch { /* ignore */ }
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [banner.id, banner.frequencyHours]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" role="dialog" aria-modal="true" aria-label={banner.title}>
      <button type="button" className="absolute inset-0 bg-brand-950/60" onClick={() => setOpen(false)} aria-label="Close" />
      <div className="card relative w-full max-w-lg overflow-hidden animate-fade-up">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand-700 shadow hover:bg-white"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>

        {banner.imageUrl ? (
          <Image src={banner.imageUrl} alt={banner.title} width={800} height={450} className="h-auto w-full object-cover" />
        ) : null}

        <div className="card-body text-center">
          <h2 className="text-lg font-bold">{banner.title}</h2>
          {banner.subtitle ? <p className="mt-1.5 text-sm text-brand-600">{banner.subtitle}</p> : null}
          {banner.linkUrl ? (
            <Link href={banner.linkUrl} className="btn-primary mt-4" onClick={() => setOpen(false)}>
              {banner.ctaLabel ?? "Shop now"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
