import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Inventory's own tab strip.
 *
 * Eleven destinations is too many for the left sidebar, so inventory carries
 * its own second level. The strip scrolls horizontally on a phone rather than
 * wrapping into three rows of stubs.
 */

export const INVENTORY_TABS = [
  { href: "/dashboard/inventory", label: "Overview", exact: true },
  { href: "/dashboard/inventory/products", label: "Products stock" },
  { href: "/dashboard/inventory/variants", label: "Variants stock" },
  { href: "/dashboard/inventory/low-stock", label: "Low stock" },
  { href: "/dashboard/inventory/out-of-stock", label: "Out of stock" },
  { href: "/dashboard/inventory/adjustments", label: "Adjustments" },
  { href: "/dashboard/inventory/movements", label: "Movements" },
  { href: "/dashboard/inventory/incoming", label: "Incoming" },
  { href: "/dashboard/inventory/returns", label: "Returns" },
  { href: "/dashboard/inventory/warehouses", label: "Warehouses" },
  { href: "/dashboard/inventory/reports", label: "Reports" },
] as const;

export function InventoryTabs({ active }: { active: string }) {
  return (
    <nav className="tabs mb-4" aria-label="Inventory sections">
      {INVENTORY_TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={cn("tab", tab.href === active && "tab-active")}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
