"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the server components on the page once an action succeeds.
 *
 * Panels that post to a server action leave the surrounding page showing the
 * pre-action data — the action returns a result, not new HTML. Without this a
 * dispatched parcel appears only after a manual reload.
 */
export function useRefreshOnSuccess<T extends { status: string }>(state: T): void {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);
}
