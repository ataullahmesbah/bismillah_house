"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";

import {
  forgotPasswordAction, loginAction, registerAction, resetPasswordAction,
} from "@/app/actions/auth";
import { Field } from "@/components/ui";
import { Captcha } from "./captcha";
import { GoogleButton } from "./google-button";
import { idleState } from "@/lib/api";
import { usePreservedForm } from "@/lib/hooks/use-preserved-form";
import { safeRedirectPath } from "@/lib/utils";
import { PasswordInput } from "@/components/ui/password-input";

function FormError({ state }: { state: { status: string; message?: string } }) {
  if (state.status !== "error") return null;
  return (
    <div className="alert-danger" role="alert">
      <div>{state.message}</div>
    </div>
  );
}

/** Whether the optional sign-in extras are configured for this shop. */
type AuthOptions = { googleEnabled?: boolean; captchaSiteKey?: string };

export function LoginForm({ googleEnabled = false, captchaSiteKey = "" }: AuthOptions) {
  const [state, formAction, pending] = useActionState(loginAction, idleState);
  const { formProps } = usePreservedForm(state);
  const params = useSearchParams();
  const next = safeRedirectPath(params.get("next"), "");
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <div className="card">
      <div className="card-body stack">
        <div>
          <h1 className="text-xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-brand-500">Welcome back. Enter your details to continue.</p>
        </div>

        {params.get("reset") === "1" ? (
          <div className="alert-success"><div>Your password has been reset. Sign in with your new password.</div></div>
        ) : null}
        {params.get("registered") === "1" ? (
          <div className="alert-success"><div>Account created. Please sign in.</div></div>
        ) : null}

        <FormError state={state} />

        <GoogleButton configured={googleEnabled} next={next} />

        <form {...formProps} action={formAction} className="stack">
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <Field label="Email" htmlFor="email" required error={fields.email}>
            <input id="email" name="email" type="email" className="input" required autoComplete="email" autoFocus maxLength={160} />
          </Field>

          <Field label="Password" htmlFor="password" required error={fields.password}>
            <PasswordInput id="password" name="password" required autoComplete="current-password" maxLength={200} />
          </Field>

          <div className="row-between">
            <Link href="/forgot-password" className="btn-link text-xs">Forgot password?</Link>
          </div>

          <Captcha siteKey={captchaSiteKey} />
          {fields.captcha ? <p className="form-error">{fields.captcha}</p> : null}

          <button type="submit" className="btn-primary btn-block" disabled={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-brand-500">
          New to us? <Link href="/register" className="link">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterForm({ googleEnabled = false, captchaSiteKey = "" }: AuthOptions) {
  const [state, formAction, pending] = useActionState(registerAction, idleState);
  const { formProps } = usePreservedForm(state);
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <div className="card">
      <div className="card-body stack">
        <div>
          <h1 className="text-xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-brand-500">Track orders, save addresses and check out faster.</p>
        </div>

        <FormError state={state} />

        <GoogleButton configured={googleEnabled} label="Sign up with Google" />

        <form {...formProps} action={formAction} className="stack">
          <Field label="Full name" htmlFor="name" required error={fields.name}>
            <input id="name" name="name" className="input" required autoComplete="name" maxLength={120} />
          </Field>

          <Field label="Email" htmlFor="email" required error={fields.email}>
            <input id="email" name="email" type="email" className="input" required autoComplete="email" maxLength={160} />
          </Field>

          <Field label="Mobile number" htmlFor="phone" required error={fields.phone} hint="Bangladeshi mobile number, e.g. 01712345678.">
            <input id="phone" name="phone" className="input" required inputMode="tel" autoComplete="tel" maxLength={20} />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            required
            error={fields.password}
            hint="At least 8 characters with upper case, lower case and a number."
          >
            <PasswordInput id="password" name="password" required autoComplete="new-password" maxLength={200} />
          </Field>

          <Field label="Confirm password" htmlFor="confirmPassword" required error={fields.confirmPassword}>
            <PasswordInput id="confirmPassword" name="confirmPassword" required autoComplete="new-password" maxLength={200} />
          </Field>

          <Captcha siteKey={captchaSiteKey} />
          {fields.captcha ? <p className="form-error">{fields.captcha}</p> : null}

          <button type="submit" className="btn-primary btn-block" disabled={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {pending ? "Creating account…" : "Create account"}
          </button>

          <p className="form-hint text-center">
            By continuing you agree to our <Link href="/terms" className="link">terms</Link> and{" "}
            <Link href="/privacy" className="link">privacy policy</Link>.
          </p>
        </form>

        <p className="text-center text-sm text-brand-500">
          Already registered? <Link href="/login" className="link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, idleState);
  const { formProps } = usePreservedForm(state);
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <div className="card">
      <div className="card-body stack">
        <div>
          <h1 className="text-xl font-bold">Reset your password</h1>
          <p className="mt-1 text-sm text-brand-500">
            Enter your email and we will send you a link to set a new password.
          </p>
        </div>

        {state.status === "success" ? (
          <div className="alert-success" role="status"><div>{state.message}</div></div>
        ) : (
          <>
            <FormError state={state} />
            <form {...formProps} action={formAction} className="stack">
              <Field label="Email" htmlFor="email" required error={fields.email}>
                <input id="email" name="email" type="email" className="input" required autoComplete="email" autoFocus maxLength={160} />
              </Field>
              <button type="submit" className="btn-primary btn-block" disabled={pending}>
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-brand-500">
          Remembered it? <Link href="/login" className="link">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, idleState);
  const { formProps } = usePreservedForm(state);
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <div className="card">
      <div className="card-body stack">
        <div>
          <h1 className="text-xl font-bold">Choose a new password</h1>
          <p className="mt-1 text-sm text-brand-500">
            For your security, all other sessions will be signed out.
          </p>
        </div>

        <FormError state={state} />

        <form {...formProps} action={formAction} className="stack">
          <input type="hidden" name="token" value={token} />

          <Field
            label="New password"
            htmlFor="password"
            required
            error={fields.password}
            hint="At least 8 characters with upper case, lower case and a number."
          >
            <PasswordInput id="password" name="password" required autoFocus autoComplete="new-password" maxLength={200} />
          </Field>

          <Field label="Confirm new password" htmlFor="confirmPassword" required error={fields.confirmPassword}>
            <PasswordInput id="confirmPassword" name="confirmPassword" required autoComplete="new-password" maxLength={200} />
          </Field>

          <button type="submit" className="btn-primary btn-block" disabled={pending}>
            {pending ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
