"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Holds whether the mobile navigation drawer is open.
 *
 * The trigger belongs in the header and the drawer belongs beside the page,
 * so the two cannot own the state between them — it lives here instead.
 *
 * "Open" is stored as the path that opened it, so navigating closes the
 * drawer during render rather than through an effect that sets state after
 * the fact, which React rejects and which would flash the drawer for a frame.
 */
type ShellState = { open: boolean; setOpen: (open: boolean) => void };

const ShellContext = createContext<ShellState>({ open: false, setOpen: () => {} });

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);

  const open = openAt === pathname;

  // Stops the page behind the drawer scrolling under it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const value: ShellState = {
    open,
    setOpen: (open) => setOpenAt(open ? pathname : null),
  };

  return <ShellContext value={value}>{children}</ShellContext>;
}

export function useDashboardShell(): ShellState {
  return useContext(ShellContext);
}

/** Hamburger for the header. Hidden once the sidebar is permanently visible. */
export function SidebarTrigger() {
  const { setOpen } = useDashboardShell();

  return (
    <button
      type="button"
      className="btn-icon -ml-1 lg:hidden"
      onClick={() => setOpen(true)}
      aria-label="Open dashboard menu"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>
  );
}
