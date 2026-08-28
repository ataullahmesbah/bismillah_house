"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import type { NavNode } from "@/lib/services/navigation";
import { OverlayPortal } from "./overlay-portal";
import { SearchBar } from "./search-bar";

/**
 * The phone and tablet menu.
 *
 * Two things went wrong in the previous version and are fixed here. Nested
 * items were always expanded, so a shop with a few categories pushed the
 * account buttons past the bottom of the screen with no way to reach them —
 * sections now collapse and only the current one opens. And the panel sized
 * itself from the page rather than the viewport, so a mobile browser's
 * collapsing address bar could hide the footer; it is now pinned to the
 * viewport with its own scroll region between a fixed header and footer.
 */
export function MobileNav({
  items,
  isAuthenticated,
  isStaff = false,
}: {
  items: NavNode[];
  isAuthenticated: boolean;
  /** Staff get a way into the dashboard without going via the desktop header. */
  isStaff?: boolean;
}) {
  const pathname = usePathname();
  // Keying the open state to the current path closes the drawer on navigation
  // without a setState-in-effect cascade.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (next: boolean) => setOpenAt(next ? pathname : null);

  useEffect(() => {
    if (!open) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenAt(null);
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The section containing the current page starts open, so someone browsing
  // "Groceries → Rice" finds their way back without hunting.
  const activeSection = items.find(
    (item) =>
      pathname === item.href ||
      item.children.some((child) => pathname === child.href),
  );

  /**
   * `null` means nobody has touched the menu yet, so the active section shows.
   * `""` means they deliberately collapsed everything — distinct from `null`,
   * or closing the active section would immediately reopen it.
   */
  function isExpanded(item: NavNode): boolean {
    return expanded === null
      ? item.id === activeSection?.id
      : expanded === item.id;
  }

  return (
    <>
      <button
        type="button"
        className="btn-icon lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open ? (
        <OverlayPortal>
          <div
            className="drawer-root lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <button
              type="button"
              className="drawer-scrim"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            />

            <div className="drawer-panel drawer-panel-left">
              <div className="drawer-header">
                <span className="text-base font-bold">Menu</span>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <div className="shrink-0 border-b border-line p-4">
                <SearchBar />
              </div>

              <nav className="drawer-body p-2" aria-label="Site sections">
                {items.map((item) => {
                  const hasChildren = item.children.length > 0;
                  const isOpen = hasChildren && isExpanded(item);

                  return (
                    <div key={item.id} className="py-0.5">
                      <div className="flex items-stretch gap-1">
                        <Link
                          href={item.href}
                          className="sidebar-link min-w-0 flex-1 font-semibold text-brand-900"
                          onClick={() => setOpen(false)}
                        >
                          <span className="truncate">{item.label}</span>
                          {item.badgeText ? (
                            <span className="badge-accent ml-auto">
                              {item.badgeText}
                            </span>
                          ) : null}
                        </Link>

                        {hasChildren ? (
                          <button
                            type="button"
                            className="btn-icon shrink-0"
                            onClick={() => setExpanded(isOpen ? "" : item.id)}
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.label}`}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              aria-hidden="true"
                              className={
                                isOpen
                                  ? "rotate-180 transition-transform"
                                  : "transition-transform"
                              }
                            >
                              <path
                                d="m6 9 6 6 6-6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        ) : null}
                      </div>

                      {isOpen ? (
                        <div className="ml-3 border-l border-line pl-2">
                          {item.children.map((child) => (
                            <Link
                              key={child.id}
                              href={child.href}
                              className="sidebar-link"
                              onClick={() => setOpen(false)}
                            >
                              <span className="truncate">{child.label}</span>
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>

              <div className="drawer-footer space-y-2">
                {isAuthenticated ? (
                  <>
                    {isStaff ? (
                      <Link
                        href="/dashboard"
                        className="btn-alt btn-block"
                        onClick={() => setOpen(false)}
                      >
                        Go to dashboard
                      </Link>
                    ) : null}
                    <Link
                      href="/account"
                      className={
                        isStaff
                          ? "btn-secondary btn-block"
                          : "btn-primary btn-block"
                      }
                      onClick={() => setOpen(false)}
                    >
                      My account
                    </Link>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href="/account/orders"
                        className="btn-ghost btn-sm"
                        onClick={() => setOpen(false)}
                      >
                        My orders
                      </Link>
                      <Link
                        href="/track-order"
                        className="btn-ghost btn-sm"
                        onClick={() => setOpen(false)}
                      >
                        Track order
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/login"
                        className="btn-secondary"
                        onClick={() => setOpen(false)}
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/register"
                        className="btn-primary"
                        onClick={() => setOpen(false)}
                      >
                        Register
                      </Link>
                    </div>
                    <Link
                      href="/track-order"
                      className="btn-ghost btn-sm btn-block"
                      onClick={() => setOpen(false)}
                    >
                      Track an order without signing in
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}
