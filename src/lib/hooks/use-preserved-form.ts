"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ActionState } from "@/lib/api";

/**
 * Keeps what the customer typed when a server action comes back with an error.
 *
 * React 19 resets an uncontrolled `<form action={…}>` once the action settles —
 * including when it settles with a validation error. Without this, mistyping a
 * single field at checkout would wipe the whole form.
 *
 * Usage:
 *   const { formProps } = usePreservedForm(state);
 *   <form {...formProps} action={formAction}>…</form>
 */
export function usePreservedForm(state: ActionState) {
  const formRef = useRef<HTMLFormElement>(null);
  const snapshot = useRef<Map<string, string[]>>(new Map());

  const capture = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    const entries = new Map<string, string[]>();
    for (const [name, value] of new FormData(form).entries()) {
      if (typeof value !== "string") continue; // files are never restored
      const bucket = entries.get(name);
      if (bucket) bucket.push(value);
      else entries.set(name, [value]);
    }
    snapshot.current = entries;
  }, []);

  useEffect(() => {
    if (state.status !== "error") return;
    const form = formRef.current;
    if (!form || snapshot.current.size === 0) return;

    // Restoring runs against the DOM, which React has already reset — this is a
    // deliberate synchronisation with an external system, not derived state.
    const remaining = new Map([...snapshot.current].map(([name, values]) => [name, [...values]]));

    for (const element of Array.from(form.elements)) {
      const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const name = field.name;
      if (!name || !snapshot.current.has(name)) continue;

      if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
        field.checked = (snapshot.current.get(name) ?? []).includes(field.value);
        continue;
      }
      if (field instanceof HTMLInputElement && field.type === "file") continue;

      const next = remaining.get(name)?.shift();
      if (next !== undefined) field.value = next;
    }
  }, [state]);

  return {
    formRef,
    formProps: { ref: formRef, onSubmit: capture } as const,
  };
}
