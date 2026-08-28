"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { markNotificationsReadAction } from "@/app/actions/account";
import { idleState } from "@/lib/api";
import type { NotificationSummary } from "@/lib/notifications";

/**
 * Bell with a dropdown of recent notifications.
 *
 * Opening it marks everything read, which is what clears the badge — the list
 * itself stays visible so nothing is lost, it just stops nagging. Each entry
 * links to the thing it is about; "See all" opens the full history.
 */
export function NotificationBell({
  notifications,
  unreadCount,
  seeAllHref = "/account/notifications",
  align = "right",
}: {
  notifications: NotificationSummary[];
  unreadCount: number;
  seeAllHref?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  // Held locally so the badge disappears the moment the panel opens, rather
  // than waiting for the server round trip.
  const [cleared, setCleared] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const badge = cleared ? 0 : unreadCount;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function markAllRead() {
    if (unreadCount === 0 || cleared) return;
    setCleared(true);
    startTransition(async () => {
      await markNotificationsReadAction(idleState, new FormData());
      router.refresh();
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="btn-icon relative"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={badge > 0 ? `Notifications, ${badge} unread` : "Notifications"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
        </svg>
        {badge > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[0.625rem] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`notification-panel ${align === "left" ? "notification-panel-left" : "notification-panel-right"}`}
          role="menu"
        >
          <div className="notification-panel-header">
            <p className="font-semibold">Notifications</p>
            <Link href={seeAllHref} className="btn-link text-xs" onClick={() => setOpen(false)}>
              See all
            </Link>
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-brand-500">You have no notifications yet.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map((notification) => {
                const content = (
                  <>
                    <span className="notification-title">{notification.title}</span>
                    {notification.body ? <span className="notification-body">{notification.body}</span> : null}
                    <time className="notification-time" dateTime={notification.createdAt}>
                      {relativeTime(notification.createdAt)}
                    </time>
                  </>
                );

                return (
                  <li key={notification.id}>
                    {notification.url ? (
                      <Link href={notification.url} className="notification-item" onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      <div className="notification-item">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Short relative label. Rendered only inside an open dropdown, which is
 * client-side by definition, so reading the clock here cannot desynchronise
 * server and client markup.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));

  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
