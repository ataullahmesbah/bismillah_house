"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_QUERY =
  "family=Inter:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700";

/**
 * Loads the Latin + Bengali webfonts without letting them block first paint.
 *
 * A plain `<link rel="stylesheet">` is render-blocking whatever `display=swap`
 * says — that setting governs the font file, not the stylesheet fetch — so a
 * slow or unreachable fonts.googleapis.com leaves the page blank until the
 * request gives up. Loading it as `media="print"` takes it off the critical
 * path, and switching to `media="all"` once it arrives applies it. The CSS
 * font stack in globals.css carries the page until then.
 *
 * next/font is not used here because it downloads the font files at build
 * time, which would break `next build` on an offline machine.
 */
export function FontStylesheet({ query = DEFAULT_QUERY }: { query?: string }) {
  const linkRef = useRef<HTMLLinkElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // A cached stylesheet can finish before React attaches the onLoad handler.
    if (linkRef.current?.sheet) setLoaded(true);
  }, []);

  return (
    <link
      ref={linkRef}
      rel="stylesheet"
      href={`https://fonts.googleapis.com/css2?${query}&display=swap`}
      media={loaded ? "all" : "print"}
      onLoad={() => setLoaded(true)}
    />
  );
}
