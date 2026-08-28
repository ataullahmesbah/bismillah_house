"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

export type PickerOption = { id: string; label: string; hint?: string; price?: number };

/**
 * Searchable multi-select used for coupon/offer eligibility and related
 * products. Emits repeated hidden inputs so it works inside a plain form post.
 */
export function MultiPicker({
  name,
  options,
  defaultSelected = [],
  label,
  emptyHint = "Nothing selected yet.",
  max = 200,
}: {
  name: string;
  options: PickerOption[];
  defaultSelected?: string[];
  label: string;
  emptyHint?: string;
  max?: number;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = term
      ? options.filter((option) => option.label.toLowerCase().includes(term) || option.hint?.toLowerCase().includes(term))
      : options;
    return pool.slice(0, 60);
  }, [options, query]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : current.length < max ? [...current, id] : current,
    );
  }

  return (
    <div className="field">
      <span className="label">{label}</span>

      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <div className="mb-2 flex flex-wrap gap-1.5">
        {selected.length === 0 ? (
          <p className="form-hint">{emptyHint}</p>
        ) : (
          selected.map((id) => (
            <button key={id} type="button" className="chip chip-active" onClick={() => toggle(id)}>
              {byId.get(id)?.label ?? id}
              <span aria-hidden="true">×</span>
            </button>
          ))
        )}
      </div>

      <input
        type="search"
        className="input"
        placeholder="Search to add…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={`Search ${label}`}
      />

      <div className="mt-2 max-h-56 overflow-y-auto rounded-[var(--radius-tm)] border border-line">
        {filtered.length === 0 ? (
          <p className="p-3 text-xs text-brand-500">No matches.</p>
        ) : (
          filtered.map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border-b border-line px-3 py-2 text-left text-sm last:border-b-0",
                  active ? "bg-brand-50 font-semibold" : "hover:bg-surface-muted",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.hint ? <span className="block truncate text-xs text-brand-400">{option.hint}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-brand-500">
                  {option.price !== undefined ? formatMoney(option.price) : active ? "Selected" : "Add"}
                </span>
              </button>
            );
          })
        )}
      </div>
      <p className="form-hint">{selected.length} selected</p>
    </div>
  );
}

/** Single-select variant used where only one target makes sense. */
export function SearchSelect({
  name,
  options,
  defaultValue = "",
  label,
  required,
  placeholder = "Search…",
}: {
  name: string;
  options: PickerOption[];
  defaultValue?: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options).slice(0, 40);
  }, [options, query]);

  const selected = options.find((option) => option.id === value);

  return (
    <div className="field">
      <label className={cn("label", required && "label-req")}>{label}</label>
      <input type="hidden" name={name} value={value} />

      {selected ? (
        <div className="row-between rounded-[var(--radius-tm)] border border-line-strong bg-white px-3 py-2 text-sm">
          <span className="truncate">{selected.label}</span>
          <button type="button" className="btn-link text-xs" onClick={() => setValue("")}>Change</button>
        </div>
      ) : (
        <>
          <input
            type="search"
            className="input"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-2 max-h-48 overflow-y-auto rounded-[var(--radius-tm)] border border-line">
            {filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => { setValue(option.id); setQuery(""); }}
                className="flex w-full items-center justify-between border-b border-line px-3 py-2 text-left text-sm last:border-b-0 hover:bg-surface-muted"
              >
                <span className="truncate">{option.label}</span>
                {option.price !== undefined ? (
                  <span className="text-xs text-brand-500">{formatMoney(option.price)}</span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
