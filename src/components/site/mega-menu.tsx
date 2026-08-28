"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { NavNode } from "@/lib/services/navigation";
import { cn } from "@/lib/utils";

/**
 * Desktop navigation with a dropdown for items that have children.
 *
 * Opening on hover alone is fragile: the pointer crosses the gap between the
 * trigger and the panel and the menu vanishes mid-reach. A short close delay
 * bridges that gap, while keyboard users get the same menu through focus, and
 * Escape closes it.
 */
export function MegaMenu({ items }: { items: NavNode[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);

  function open(id: string) {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpenId(id);
  }

  /** Delayed so a diagonal mouse path to the panel does not dismiss it. */
  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenId(null), 140);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main navigation">
      {items.map((item) => {
        const hasChildren = item.children.length > 0;
        const isOpen = openId === item.id;

        return (
          <div
            key={item.id}
            className="relative"
            onMouseEnter={() => hasChildren && open(item.id)}
            onMouseLeave={scheduleClose}
          >
            <Link
              href={item.href}
              className={cn("nav-link inline-flex items-center gap-1.5", isOpen && "nav-link-active")}
              target={item.openInNewTab ? "_blank" : undefined}
              rel={item.openInNewTab ? "noopener noreferrer" : undefined}
              onFocus={() => hasChildren && open(item.id)}
              aria-haspopup={hasChildren || undefined}
              aria-expanded={hasChildren ? isOpen : undefined}
            >
              {item.label}
              {item.badgeText ? <span className="badge-accent">{item.badgeText}</span> : null}
              {hasChildren ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  aria-hidden="true"
                  className={cn("transition-transform duration-150", isOpen && "rotate-180")}
                >
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </Link>

            {hasChildren && isOpen ? (
              <div
                className={cn(
                  "absolute left-0 top-full z-40 pt-2",
                  item.isMegaColumn ? "w-[min(46rem,90vw)]" : "w-64",
                )}
              >
                <div className="menu-panel animate-fade-up">
                  <div className={cn("grid gap-0.5", item.isMegaColumn && "grid-cols-3 gap-x-2")}>
                    {item.children.map((child) => (
                      <Link key={child.id} href={child.href} className="menu-item">
                        <span className="min-w-0 flex-1">
                          <span className="menu-item-label">{child.label}</span>
                          {child.description ? (
                            <span className="menu-item-description">{child.description}</span>
                          ) : null}
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          aria-hidden="true"
                          className="menu-item-arrow"
                        >
                          <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    ))}
                  </div>

                  {/* A way through to the whole section, not just its children. */}
                  <Link href={item.href} className="menu-panel-footer">
                    See everything in {item.label}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
