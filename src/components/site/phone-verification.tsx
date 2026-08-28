"use client";

import { useEffect, useState, useTransition } from "react";

import { requestCheckoutOtpAction, verifyCheckoutOtpAction } from "@/app/actions/checkout";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/api";

/**
 * Mobile-number confirmation step at checkout.
 *
 * Cash on delivery makes fake orders cheap, so when the shop turns this on the
 * shopper proves the number is theirs before the order is accepted. This is
 * only the interface: the order action independently spends a verification
 * server-side, so skipping the widget achieves nothing.
 */
export function PhoneVerification({
  phone,
  verified,
  onVerified,
}: {
  phone: string;
  verified: boolean;
  onVerified: () => void;
}) {
  /*
   * Both pieces of state are tagged with the number they belong to, and
   * compared during render. Editing the number therefore invalidates the code
   * already sent without an effect reaching back to reset state — which React
   * rightly rejects, and which would also flash the stale state for a frame.
   */
  const [sentFor, setSentFor] = useState<string | null>(null);
  const [entry, setEntry] = useState<{ phone: string; code: string }>({ phone: "", code: "" });
  const [cooldown, setCooldown] = useState(0);
  const [busy, startTransition] = useTransition();
  const toast = useToast();

  const usable = /^01[3-9]\d{8}$/.test(phone.replace(/[\s-]/g, "").replace(/^\+?880/, "0"));
  const sent = sentFor === phone;
  const code = entry.phone === phone ? entry.code : "";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function sendCode() {
    const formData = new FormData();
    formData.append("phone", phone);

    startTransition(async () => {
      const result = await requestCheckoutOtpAction(idleState, formData);
      if (result.status === "error") {
        toast.error("Could not send the code", result.message);
        return;
      }
      setSentFor(phone);
      setEntry({ phone, code: "" });
      setCooldown(60);
      toast.success(result.status === "success" ? (result.message ?? "Code sent.") : "Code sent.");
    });
  }

  function submitCode() {
    const formData = new FormData();
    formData.append("phone", phone);
    formData.append("code", code);

    startTransition(async () => {
      const result = await verifyCheckoutOtpAction(idleState, formData);
      if (result.status === "error") {
        toast.error("Verification failed", result.message);
        return;
      }
      onVerified();
      toast.success("Mobile number verified.");
    });
  }

  if (verified) {
    return (
      <div className="alert-success" role="status">
        <div>
          <p className="font-semibold">Mobile number verified</p>
          <p className="text-xs">You can place your order.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel stack">
      <div>
        <p className="font-semibold">Verify your mobile number</p>
        <p className="form-hint">
          We send a 6-digit code to confirm the number, so your order is not delayed by a wrong contact.
        </p>
      </div>

      {!usable ? (
        <p className="form-hint">Enter a valid mobile number above to receive a code.</p>
      ) : !sent ? (
        <button type="button" className="btn-secondary" onClick={sendCode} disabled={busy}>
          {busy ? "Sending…" : "Send code"}
        </button>
      ) : (
        <>
          <div className="input-affix">
            <input
              className="input mono tracking-[0.3em]"
              value={code}
              onChange={(event) => setEntry({ phone, code: event.target.value.replace(/\D/g, "").slice(0, 6) })}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Verification code"
            />
            <button
              type="button"
              className="input-affix-text font-semibold hover:bg-brand-100"
              onClick={submitCode}
              disabled={busy || code.length !== 6}
            >
              Verify
            </button>
          </div>
          <button
            type="button"
            className="btn-link self-start text-xs"
            onClick={sendCode}
            disabled={busy || cooldown > 0}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </>
      )}
    </div>
  );
}
