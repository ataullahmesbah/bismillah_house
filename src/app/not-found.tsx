import type { Metadata } from "next";
import Link from "next/link";

/*
 * The 404 body streams inside the layout, so the response has already gone out
 * as HTTP 200 by the time this renders and Next cannot swap the status. That
 * makes this metadata the only thing telling a crawler not to index it — and
 * without it the page inherits the site default of "index, follow", which is
 * how "We couldn't find that page" ends up in search results.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted p-6">
      <div className="card max-w-md p-8 text-center">
        <p className="text-5xl font-extrabold tracking-tight text-brand-300">404</p>
        <h1 className="mt-3 text-xl font-bold">We couldn’t find that page</h1>
        <p className="mt-2 text-sm text-brand-600">
          The link may be broken, or the page may have been moved or removed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary">Back to home</Link>
          <Link href="/shop" className="btn-secondary">Browse products</Link>
          <Link href="/help" className="btn-ghost">Help centre</Link>
        </div>
      </div>
    </div>
  );
}
