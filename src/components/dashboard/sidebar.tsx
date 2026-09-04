"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import type { NavGroup } from "@/lib/dashboard-nav";
import { NavIcon } from "./nav-icons";
import { useDashboardShell } from "./shell";
import { cn } from "@/lib/utils";

export function DashboardSidebar({
  groups,
  user,
  siteName,
  badges,
}: {
  groups: NavGroup[];
  user: { name: string; role: string };
  siteName: string;
  /** Counts to show beside a nav item, keyed by href. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  // Owned by DashboardShell, because the trigger lives in the header.
  const { open, setOpen } = useDashboardShell();

  const nav = (
    <nav className="flex h-full flex-col" aria-label="Dashboard navigation">
      <div className="border-b border-white/10 px-4 py-4">
        <Link href="/dashboard" className="block text-base font-extrabold tracking-tight text-white">
          {siteName}
        </Link>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-400">
          <span className="size-1.5 rounded-full bg-success-500" aria-hidden="true" />
          <span className="truncate">{user.name}</span>
          <span className="text-brand-500">·</span>
          <span className="shrink-0 capitalize">{user.role.replace("_", " ").toLowerCase()}</span>
        </p>
      </div>

      <div className="scroll-x flex-1 overflow-y-auto p-2">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="rail-group-label">{group.label}</p>
            {group.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("rail-link", active && "rail-link-active")}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon name={item.icon} />
                  <span className="truncate">{item.label}</span>
                  {badges?.[item.href] ? <span className="rail-badge">{badges[item.href]}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-2">
        <Link href="/" className="rail-link">
          <NavIcon name="storefront" />
          <span className="truncate">View storefront</span>
        </Link>
        <Link href="/account" className="rail-link">
          <NavIcon name="account" />
          <span className="truncate">My account</span>
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="rail-link w-full text-danger-300 hover:bg-danger-500/20 hover:text-danger-100">
            <NavIcon name="signout" />
            <span className="truncate">Sign out</span>
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 bg-brand-950 lg:block">
        {nav}
      </aside>

      {/*
       * overflow-hidden on both the overlay and the panel: without it a long
       * navigation label spills out of the drawer and widens the document, so
       * opening the menu makes the whole dashboard scroll sideways.
       */}
      {open ? (
        <div className="fixed inset-0 z-50 overflow-hidden lg:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-brand-950/50" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-x-hidden bg-brand-950 shadow-[var(--shadow-tm-lg)]">
            {nav}
          </div>
        </div>
      ) : null}
    </>
  );
}
