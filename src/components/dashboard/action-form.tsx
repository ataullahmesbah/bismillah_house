"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { ActionFormContext } from "@/components/dashboard/action-form-context";
import { useToast } from "@/components/ui/toast";
import { idleState, type ActionState } from "@/lib/api";
import { usePreservedForm } from "@/lib/hooks/use-preserved-form";
import { cn } from "@/lib/utils";

export type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

type RenderProps = { pending: boolean; fields: Record<string, string>; state: ActionState };

/**
 * Wraps a server action so any dashboard page can stay a server component and
 * still get pending state, inline field errors and success feedback.
 *
 * Server components must pass plain children: a function cannot be serialised
 * across the server/client boundary, and React rejects the whole render if one
 * is. Use `SubmitButton` (which reads `useFormStatus`) and `FieldError` for the
 * pending and error state instead. The render-prop form below is for callers
 * that are themselves client components.
 */
export function ActionForm({
  action,
  children,
  className,
  successRedirect = true,
  id,
}: {
  action: ServerAction;
  children: React.ReactNode | ((props: RenderProps) => React.ReactNode);
  className?: string;
  successRedirect?: boolean;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const router = useRouter();
  const { formProps } = usePreservedForm(state);

  useEffect(() => {
    if (state.status !== "success") return;
    if (successRedirect && state.redirectTo) router.push(state.redirectTo);
    else router.refresh();
  }, [state, router, successRedirect]);

  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  // React resets an uncontrolled form once the action resolves; usePreservedForm
  // puts the values back when it resolved with an error.
  return (
    <ActionFormContext value={{ pending, fields, state }}>
      <form {...formProps} id={id} action={formAction} className={className}>
        <FormFeedback state={state} />
        {typeof children === "function" ? children({ pending, fields, state }) : children}
      </form>
    </ActionFormContext>
  );
}

export function FormFeedback({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "success" && state.message) {
    return <div className={cn("alert-success mb-4", className)} role="status"><div>{state.message}</div></div>;
  }
  if (state.status === "error") {
    return <div className={cn("alert-danger mb-4", className)} role="alert"><div>{state.message}</div></div>;
  }
  return null;
}

/**
 * Submit button that reflects the parent form's pending state.
 *
 * It reads the state from `useFormStatus` so a server component can drop the
 * button anywhere inside an `ActionForm` without threading a prop through —
 * a render prop cannot cross the server/client boundary. The `pending` prop
 * stays available for client callers that already have the value to hand.
 */
export function SubmitButton({
  children,
  pending,
  className = "btn-primary",
  confirm,
}: {
  children: React.ReactNode;
  pending?: boolean;
  className?: string;
  confirm?: string;
}) {
  const status = useFormStatus();
  const isPending = pending ?? status.pending;

  return (
    <button
      type="submit"
      className={className}
      disabled={isPending}
      onClick={confirm ? (event) => { if (!window.confirm(confirm)) event.preventDefault(); } : undefined}
    >
      {isPending ? <span className="spinner" aria-hidden="true" /> : null}
      {isPending ? "Saving…" : children}
    </button>
  );
}

/**
 * A one-button trigger for a destructive or single-value action
 * (archive, toggle, delete). Renders its own confirmation.
 *
 * It calls the server action directly rather than wrapping itself in a
 * `<form>`: these buttons sit inside table rows that are themselves often
 * inside an editor form, and HTML forbids a nested form — React rejects the
 * hydration and the browser drops the inner form entirely, so the button
 * would silently submit the wrong thing.
 */
export function QuickActionForm({
  action,
  values,
  label,
  className = "btn-secondary btn-xs",
  confirm,
}: {
  action: ServerAction;
  values: Record<string, string>;
  label: string;
  className?: string;
  confirm?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function run() {
    if (confirm && !window.confirm(confirm)) return;

    const formData = new FormData();
    for (const [name, value] of Object.entries(values)) formData.append(name, value);

    startTransition(async () => {
      const result = await action(idleState, formData);
      if (result.status === "error") {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      setError(null);
      if (result.status === "success" && result.message) toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      title={error ?? undefined}
      onClick={run}
    >
      {pending ? "…" : label}
    </button>
  );
}
