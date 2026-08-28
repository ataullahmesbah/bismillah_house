"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide toggle.
 *
 * Typing a password blind on a phone keyboard is where most failed sign-ins
 * come from, so every password field in the shop offers to reveal it. The
 * toggle is a real button: it is reachable by keyboard and announces which
 * state it will switch to.
 */
export function PasswordInput({
  id,
  name,
  className,
  autoComplete = "current-password",
  required,
  autoFocus,
  maxLength = 200,
  placeholder,
  defaultValue,
}: {
  id?: string;
  name: string;
  className?: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  placeholder?: string;
  defaultValue?: string;
}) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? `${name}-${generatedId}`;

  return (
    <div className="password-field">
      <input
        id={inputId}
        name={name}
        type={visible ? "text" : "password"}
        className={cn("input pr-11", className)}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        // Not a tab stop between the field and the submit button — the eye is
        // a convenience, and keyboard users still reach it after the input.
        tabIndex={0}
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M3 3l18 18" strokeLinecap="round" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
            <path d="M9.4 5.2A9.7 9.7 0 0 1 12 4.9c4.5 0 8.1 3.4 9.3 7.1a12 12 0 0 1-2.4 3.8M6.2 6.7A12.3 12.3 0 0 0 2.7 12c1.2 3.7 4.8 7.1 9.3 7.1 1.5 0 2.9-.4 4.1-1" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M2.7 12C3.9 8.3 7.5 4.9 12 4.9s8.1 3.4 9.3 7.1c-1.2 3.7-4.8 7.1-9.3 7.1S3.9 15.7 2.7 12Z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        )}
      </button>
    </div>
  );
}
