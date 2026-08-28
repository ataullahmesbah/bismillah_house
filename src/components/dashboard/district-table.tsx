"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { bulkUpdateDistrictsAction, saveDistrictAction } from "@/app/actions/dashboard/settings";
import { FormFeedback, SubmitButton } from "./action-form";
import { Field } from "@/components/ui";
import { idleState } from "@/lib/api";
import { formatMoney, fromMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

export type DistrictRow = {
  id: string;
  name: string;
  nameBn: string | null;
  division: string;
  deliveryCharge: number;
  isFreeDelivery: boolean;
  isActive: boolean;
  estimatedDays: string | null;
};

/**
 * BANGLADESH 64-DISTRICT DELIVERY MODULE (PRD update §3)
 *
 * Bulk rule first — set one charge for every district except the ones you
 * exclude (typically Dhaka) — then override individual districts to a custom
 * charge or to free delivery.
 */
export function DistrictManager({ districts }: { districts: DistrictRow[] }) {
  const router = useRouter();
  const [bulkState, bulkAction, bulkPending] = useActionState(bulkUpdateDistrictsAction, idleState);
  const [rowState, rowAction, rowPending] = useActionState(saveDistrictAction, idleState);
  const [query, setQuery] = useState("");
  const [excluded, setExcluded] = useState<string[]>(
    () => districts.filter((district) => district.name === "Dhaka").map((district) => district.id),
  );

  useEffect(() => {
    if (bulkState.status === "success" || rowState.status === "success") router.refresh();
  }, [bulkState, rowState, router]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return districts;
    return districts.filter(
      (district) =>
        district.name.toLowerCase().includes(term) ||
        district.division.toLowerCase().includes(term) ||
        (district.nameBn ?? "").includes(term),
    );
  }, [districts, query]);

  const byDivision = useMemo(() => {
    const map = new Map<string, DistrictRow[]>();
    for (const district of filtered) {
      const bucket = map.get(district.division);
      if (bucket) bucket.push(district);
      else map.set(district.division, [district]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const freeCount = districts.filter((district) => district.isFreeDelivery).length;
  const inactiveCount = districts.filter((district) => !district.isActive).length;

  return (
    <div className="stack">
      <form action={bulkAction} className="card">
        <div className="card-header">
          <h2 className="card-title">Bulk rule</h2>
          <span className="muted-xs">{districts.length} districts · {freeCount} free · {inactiveCount} inactive</span>
        </div>
        <div className="card-body stack">
          <FormFeedback state={bulkState} />

          <p className="text-sm text-brand-600">
            Set one delivery charge for every district except the ones you exclude below, then fine-tune
            individual districts in the table. Example: Dhaka ৳60, every other district ৳120, then Sylhet free
            and Chattogram ৳100.
          </p>

          <div className="grid-form-2">
            <Field label="Charge for the other districts (৳)" htmlFor="defaultCharge" required>
              <input id="defaultCharge" name="defaultCharge" type="number" step="0.01" min="0" className="input" required defaultValue={120} />
            </Field>
            <label className="check-row self-end">
              <input type="checkbox" name="applyToInactive" className="checkbox mt-0.5" />
              <span>Also update inactive districts</span>
            </label>
          </div>

          <div className="field">
            <span className="label">Exclude these districts from the bulk update</span>
            {excluded.map((id) => (
              <input key={id} type="hidden" name="excludeIds" value={id} />
            ))}
            <div className="flex flex-wrap gap-1.5">
              {districts.map((district) => {
                const isExcluded = excluded.includes(district.id);
                return (
                  <button
                    key={district.id}
                    type="button"
                    className={cn("chip", isExcluded && "chip-active")}
                    onClick={() =>
                      setExcluded((current) =>
                        current.includes(district.id)
                          ? current.filter((id) => id !== district.id)
                          : [...current, district.id],
                      )
                    }
                  >
                    {district.name}
                  </button>
                );
              })}
            </div>
            <p className="form-hint">{excluded.length} excluded — their current charges stay untouched.</p>
          </div>
        </div>
        <div className="card-footer">
          <SubmitButton
            pending={bulkPending}
            className="btn-primary"
            confirm="Apply this charge to every district except the excluded ones?"
          >
            Apply bulk charge
          </SubmitButton>
        </div>
      </form>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Per-district charges</h2>
          <input
            type="search"
            className="input h-9 w-48 text-sm"
            placeholder="Search district…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search districts"
          />
        </div>

        <FormFeedback state={rowState} className="mx-5 mt-4" />

        <div className="card-body stack">
          {byDivision.map(([division, rows]) => (
            <div key={division}>
              <p className="sidebar-group-label px-0">{division} division</p>
              <div className="table-wrap">
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>District</th>
                      <th className="text-right">Charge (৳)</th>
                      <th>Free</th>
                      <th>Active</th>
                      <th>Est. days</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((district) => (
                      <tr key={district.id}>
                        <td>
                          <p className="font-semibold">{district.name}</p>
                          {district.nameBn ? <p className="muted-xs">{district.nameBn}</p> : null}
                        </td>
                        <td colSpan={5}>
                          <form action={rowAction} className="flex flex-wrap items-center justify-end gap-2">
                            <input type="hidden" name="id" value={district.id} />
                            <input
                              name="deliveryCharge"
                              type="number"
                              step="0.01"
                              min="0"
                              className="input w-24 text-right"
                              defaultValue={fromMinor(district.deliveryCharge)}
                              aria-label={`Delivery charge for ${district.name}`}
                            />
                            {/*
                              The visible text stays short so 64 rows remain
                              scannable, but on its own "Free" repeated 64 times
                              tells a screen reader nothing — hence the
                              district name in the accessible name.
                            */}
                            <label className="flex items-center gap-1.5 text-xs font-medium">
                              <input
                                type="checkbox"
                                name="isFreeDelivery"
                                className="checkbox"
                                defaultChecked={district.isFreeDelivery}
                                aria-label={`Free delivery for ${district.name}`}
                              />
                              Free
                            </label>
                            <label className="flex items-center gap-1.5 text-xs font-medium">
                              <input
                                type="checkbox"
                                name="isActive"
                                className="checkbox"
                                defaultChecked={district.isActive}
                                aria-label={`${district.name} is active`}
                              />
                              Active
                            </label>
                            <input
                              name="estimatedDays"
                              className="input w-20 text-center text-xs"
                              defaultValue={district.estimatedDays ?? ""}
                              placeholder="2-4"
                              aria-label={`Estimated days for ${district.name}`}
                            />
                            <button type="submit" className="btn-secondary btn-xs" disabled={rowPending}>Save</button>
                            <span className="muted-xs w-20 text-right">
                              {district.isFreeDelivery ? "Free" : formatMoney(district.deliveryCharge)}
                            </span>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {byDivision.length === 0 ? <p className="muted">No districts match that search.</p> : null}
        </div>
      </section>
    </div>
  );
}
