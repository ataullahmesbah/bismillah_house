import Link from "next/link";

import { cn } from "@/lib/utils";

export const COURIER_TABS = [
  { href: "/dashboard/courier", label: "Overview" },
  { href: "/dashboard/courier/shipments", label: "Shipments" },
  { href: "/dashboard/courier/settlements", label: "Settlements" },
  { href: "/dashboard/courier/logs", label: "Dispatch log" },
] as const;

export function CourierTabs({ active }: { active: string }) {
  return (
    <nav className="tabs mb-4" aria-label="Courier sections">
      {COURIER_TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={cn("tab", tab.href === active && "tab-active")}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
