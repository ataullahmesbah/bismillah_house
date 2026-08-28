"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import type { NavGroup } from "@/lib/dashboard-nav";
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

      {/* Dashboard Shop Name, User Name, Role  */}
      <div className="border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent px-4 py-5">
        <Link href="/dashboard" className="group flex items-center gap-2.5 transition-all hover:translate-x-0.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/25">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-6.75a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
            </svg>
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white transition-colors group-hover:text-brand-200">
            {siteName}
          </span>
        </Link>

        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
            <div className="relative flex-shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/20 to-brand-600/20 ring-1 ring-white/20">
                <span className="text-xs font-semibold text-white/90">{user.name.charAt(0).toUpperCase()}</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white/20 shadow-lg shadow-emerald-400/30">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              </span>
            </div>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{user.name}</p>
          </div>

          <div className="flex items-center justify-between rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-white/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span className="text-xs font-medium capitalize text-white/60">{user.role.replace("_", " ").toLowerCase()}</span>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60"></span>
          </div>
        </div>
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
                  <span className="truncate">{item.label}</span>
                  {badges?.[item.href] ? <span className="rail-badge">{badges[item.href]}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-2">
        <Link href="/" className="rail-link">View storefront</Link>
        <Link href="/account" className="rail-link">My account</Link>
        <form action={logoutAction}>
          <button type="submit" className="rail-link w-full text-danger-300 hover:bg-danger-500/20 hover:text-danger-100">
            Sign out
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
