"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/orders", label: "My orders" },
  { href: "/account/reviews", label: "My reviews" },
  { href: "/account/messages", label: "Messages", badge: "messages" as const },
  { href: "/account/notifications", label: "Notifications", badge: "notifications" as const },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/security", label: "Security" },
];

export function AccountNav({ notificationCount, messageCount }: { notificationCount: number; messageCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="card p-2" aria-label="Account navigation">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        const count = link.badge === "notifications" ? notificationCount : link.badge === "messages" ? messageCount : 0;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn("sidebar-link justify-between", active && "sidebar-link-active")}
            aria-current={active ? "page" : undefined}
          >
            <span>{link.label}</span>
            {count > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-600 px-1.5 text-[0.625rem] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Link>
        );
      })}

      <form action={logoutAction} className="mt-1 border-t border-line pt-1">
        <button type="submit" className="sidebar-link w-full text-danger-600 hover:bg-danger-50 hover:text-danger-700">
          Sign out
        </button>
      </form>
    </nav>
  );
}
