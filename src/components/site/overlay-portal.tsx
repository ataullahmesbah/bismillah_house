"use client";

import { createPortal } from "react-dom";

/**
 * Renders an overlay at the end of `<body>`, outside whatever contains it.
 *
 * Both drawers live inside the site header, and the header carries
 * `backdrop-blur`. A `backdrop-filter` makes an element the containing block
 * for its `fixed`-position descendants — so `fixed inset-0` resolved against
 * the 144px-tall header instead of the viewport, the panel collapsed to that
 * height, and the footer painted over the cart items. Nothing looked obviously
 * wrong; the buttons underneath simply stopped being clickable.
 *
 * A portal moves the overlay out of that subtree entirely, which fixes the
 * whole class of problem rather than this one header.
 *
 * No mount effect is needed. Callers render this only while their drawer is
 * open, and a drawer can only be opened by a click — so by the time this runs
 * there is a document, and the server render never reaches it.
 */
export function OverlayPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
