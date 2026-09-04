import Link from "next/link";

import { cn } from "@/lib/utils";

export const BLOG_TABS = [
  { href: "/dashboard/blog", label: "Articles", exact: true },
  { href: "/dashboard/blog/new", label: "Write" },
  { href: "/dashboard/blog/categories", label: "Categories" },
] as const;

export function BlogTabs({ active }: { active: string }) {
  return (
    <nav className="tabs mb-4" aria-label="Blog sections">
      {BLOG_TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={cn("tab", tab.href === active && "tab-active")}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
