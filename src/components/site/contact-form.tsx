"use client";

import { useActionState } from "react";

import { submitContactAction } from "@/app/actions/public";
import { Field } from "@/components/ui";
import { idleState } from "@/lib/api";
import { usePreservedForm } from "@/lib/hooks/use-preserved-form";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactAction, idleState);
  const { formProps } = usePreservedForm(state);
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  if (state.status === "success") {
    return (
      <div className="alert-success" role="status">
        <div>
          <p className="font-semibold">Message sent</p>
          <p className="text-xs">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <form {...formProps} action={formAction} className="card">
      <div className="card-header"><h2 className="card-title">Send us a message</h2></div>
      <div className="card-body grid-form-2">
        {state.status === "error" ? (
          <div className="sm:col-span-2"><div className="alert-danger" role="alert"><div>{state.message}</div></div></div>
        ) : null}

        <Field label="Your name" htmlFor="name" required error={fields.name}>
          <input id="name" name="name" className="input" required maxLength={120} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="email" required error={fields.email}>
          <input id="email" name="email" type="email" className="input" required maxLength={160} autoComplete="email" />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone" error={fields.phone}>
          <input id="phone" name="phone" className="input" inputMode="tel" placeholder="01XXXXXXXXX" maxLength={20} autoComplete="tel" />
        </Field>
        <Field label="Subject" htmlFor="subject" required error={fields.subject}>
          <input id="subject" name="subject" className="input" required maxLength={200} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Message" htmlFor="message" required error={fields.message}>
            <textarea id="message" name="message" className="textarea" required rows={5} maxLength={4000} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {pending ? "Sending…" : "Send message"}
          </button>
        </div>
      </div>
    </form>
  );
}
