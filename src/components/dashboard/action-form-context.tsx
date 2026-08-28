"use client";

import { createContext, useContext } from "react";

import { idleState, type ActionState } from "@/lib/api";

export type ActionFormState = {
  pending: boolean;
  fields: Record<string, string>;
  state: ActionState;
};

const EMPTY: ActionFormState = { pending: false, fields: {}, state: idleState };

/**
 * Carries the running action's state down to whatever is inside the form.
 *
 * A server component cannot receive it through a render prop — functions do
 * not cross the server/client boundary — so the pieces that need the state
 * (the submit button, the per-field errors) read it from here instead.
 */
export const ActionFormContext = createContext<ActionFormState>(EMPTY);

export function useActionFormState(): ActionFormState {
  return useContext(ActionFormContext);
}

/** Inline validation error for one field, resolved from the enclosing form. */
export function ContextFieldError({ name }: { name: string }) {
  const { fields } = useActionFormState();
  const message = fields[name];
  if (!message) return null;
  return <p className="form-error">{message}</p>;
}
