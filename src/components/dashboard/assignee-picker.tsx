"use client";

import { useState } from "react";

import { ContextFieldError } from "@/components/dashboard/action-form-context";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/generated/prisma/client";

/**
 * Chooses who a token goes to.
 *
 * "Everyone on the team" is a checkbox rather than a select-all, because the
 * intent matters: the server resolves it to the staff who exist at that
 * moment, so a token addressed to the whole team still reaches someone who
 * joined after it was written.
 */
export function AssigneePicker({
  staff,
  selectedIds = [],
  everyone = false,
}: {
  staff: Array<{ id: string; name: string; email: string; role: Role }>;
  selectedIds?: string[];
  everyone?: boolean;
}) {
  const [all, setAll] = useState(everyone);

  return (
    <fieldset className="fieldset">
      <legend className="label">Assign to</legend>

      <label className="check-row">
        <input
          type="checkbox"
          name="assignEveryone"
          className="checkbox mt-0.5"
          checked={all}
          onChange={(event) => setAll(event.target.checked)}
        />
        <span className="min-w-0">
          <span className="block font-semibold">Everyone on the team</span>
          <span className="block text-xs text-brand-500">
            All active staff are assigned and notified.
          </span>
        </span>
      </label>

      <div className={all ? "pointer-events-none mt-2 grid gap-1.5 opacity-45 sm:grid-cols-2" : "mt-2 grid gap-1.5 sm:grid-cols-2"}>
        {staff.map((member) => (
          <label key={member.id} className="check-row">
            <input
              type="checkbox"
              name="assigneeIds"
              value={member.id}
              className="checkbox mt-0.5"
              defaultChecked={selectedIds.includes(member.id)}
              disabled={all}
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">{member.name}</span>
              <span className="block text-xs text-brand-500">{ROLE_LABELS[member.role]}</span>
            </span>
          </label>
        ))}
      </div>

      <ContextFieldError name="assigneeIds" />
    </fieldset>
  );
}
