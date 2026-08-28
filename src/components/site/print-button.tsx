"use client";

export function PrintButton({ label = "Print invoice" }: { label?: string }) {
  return (
    <button type="button" className="btn-primary btn-sm no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
