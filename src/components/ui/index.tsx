import Link from "next/link";
import type { ReactNode } from "react";

import { ContextFieldError } from "@/components/dashboard/action-form-context";

import { cn, humanizeEnum } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { statusClass } from "@/lib/constants";

/**
 * Presentational primitives.
 *
 * These are deliberately thin: the visual language lives in the global
 * component classes in `globals.css`, so a component here only decides
 * structure and which class to use — never a long utility string.
 */

/* -------------------------------------------------------------------------- */

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return <span className={cn(statusClass(status), className)}>{humanizeEnum(status)}</span>;
}

export function Price({
  amount,
  compareAt,
  size = "md",
  className,
}: {
  amount: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const priceClass = size === "lg" ? "price-lg" : size === "sm" ? "text-sm font-bold" : "price";
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-2", className)}>
      <span className={priceClass}>{formatMoney(amount)}</span>
      {compareAt && compareAt > amount ? (
        <span className="price-old">{formatMoney(compareAt)}</span>
      ) : null}
    </span>
  );
}

export function Rating({ value, count, showCount = true }: { value: number; count?: number; showCount?: boolean }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    /*
     * `role="img"` is required, not decoration: ARIA forbids aria-label on a
     * plain span, which has no role, and a screen reader is entitled to ignore
     * it — leaving the rating as five unlabelled decorative stars.
     */
    <span role="img" className="inline-flex items-center gap-1.5" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <span className="rating-stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} filled={rounded >= star} half={rounded === star - 0.5} />
        ))}
      </span>
      {showCount ? (
        <span className="muted-xs">
          {value > 0 ? value.toFixed(1) : "New"}
          {typeof count === "number" && count > 0 ? ` (${count})` : ""}
        </span>
      ) : null}
    </span>
  );
}

function Star({ filled, half }: { filled: boolean; half?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <defs>
        {half ? (
          <linearGradient id="tm-half">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        ) : null}
      </defs>
      <path
        d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"
        fill={half ? "url(#tm-half)" : filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ? <div className="mb-1 text-brand-300">{icon}</div> : null}
      <p className="empty-title">{title}</p>
      {description ? <p className="empty-desc">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`alert-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-desc">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span className="text-brand-800">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const windowSize = 2;
  const pages: number[] = [];
  for (let i = Math.max(1, page - windowSize); i <= Math.min(totalPages, page + windowSize); i += 1) {
    pages.push(i);
  }

  return (
    <nav className="pagination mt-8" aria-label="Pagination">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        className={cn("page-link", page === 1 && "page-link-disabled")}
        aria-disabled={page === 1}
        rel="prev"
      >
        Previous
      </Link>
      {pages[0] !== undefined && pages[0] > 1 ? (
        <>
          <Link href={buildHref(1)} className="page-link">1</Link>
          {pages[0] > 2 ? <span className="px-1 text-brand-400">…</span> : null}
        </>
      ) : null}
      {pages.map((value) => (
        <Link
          key={value}
          href={buildHref(value)}
          className={cn("page-link", value === page && "page-link-active")}
          aria-current={value === page ? "page" : undefined}
        >
          {value}
        </Link>
      ))}
      {pages.at(-1) !== undefined && (pages.at(-1) as number) < totalPages ? (
        <>
          {(pages.at(-1) as number) < totalPages - 1 ? <span className="px-1 text-brand-400">…</span> : null}
          <Link href={buildHref(totalPages)} className="page-link">{totalPages}</Link>
        </>
      ) : null}
      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        className={cn("page-link", page === totalPages && "page-link-disabled")}
        aria-disabled={page === totalPages}
        rel="next"
      >
        Next
      </Link>
    </nav>
  );
}

export function StatCard({
  label,
  value,
  delta,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  delta?: { value: string; positive: boolean };
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {delta ? (
        <p className={delta.positive ? "stat-delta-up" : "stat-delta-down"}>
          {delta.positive ? "▲" : "▼"} {delta.value}
        </p>
      ) : null}
      {hint ? <p className="muted-xs mt-1">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="stat-card block transition-shadow hover:shadow-[var(--shadow-tm-md)]">
        {body}
      </Link>
    );
  }
  return <div className="stat-card">{body}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

/** Renders a JSON-LD script tag. Data is generated server-side only. */
export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return (
    <script
      type="application/ld+json"
      // The payload is built by our own SEO helpers from database values.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="form-error">{message}</p>;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  errorFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  /**
   * Field name to read the error for from the enclosing `ActionForm`. Server
   * components use this, since they cannot take the error from a render prop.
   */
  errorFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className={cn("label", required && "label-req")} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error ? <p className="form-hint">{hint}</p> : null}
      {error ? <FieldError message={error} /> : errorFor ? <ContextFieldError name={errorFor} /> : null}
    </div>
  );
}
