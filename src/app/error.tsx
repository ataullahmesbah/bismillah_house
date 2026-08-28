"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Global error boundary. Users see a safe message; the real error is logged on
 * the server and never rendered to the page.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[trust-mart] client error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted p-6">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-brand-600">
          We hit an unexpected problem. Please try again — if it keeps happening, contact our support team.
        </p>
        {error.digest ? <p className="mono mt-3 text-xs text-brand-400">Reference: {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-secondary">Back to home</Link>
        </div>
      </div>
    </div>
  );
}
