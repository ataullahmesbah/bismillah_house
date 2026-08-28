"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing when no site key is configured, so an unconfigured shop
 * shows a clean form rather than an empty box. The token is written into a
 * hidden input, and the server verifies it independently — the widget being
 * present proves nothing on its own.
 */
export function Captcha({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const fieldId = useId();

  useEffect(() => {
    if (!ready || !siteKey || !containerRef.current) return;

    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!turnstile) return;

    // Guard against a double render in development's strict mode.
    if (widgetId.current) return;

    widgetId.current = turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "light",
      action: "auth",
    });

    return () => {
      if (widgetId.current) {
        turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [ready, siteKey]);

  if (!siteKey) return null;

  return (
    <div className="field">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        onLoad={() => setReady(true)}
      />
      <div ref={containerRef} id={fieldId} className="min-h-[65px]" />
      <noscript>
        <p className="form-hint">JavaScript is required to complete the verification.</p>
      </noscript>
    </div>
  );
}

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: { sitekey: string; theme?: string; action?: string },
  ) => string;
  remove: (widgetId: string) => void;
};
