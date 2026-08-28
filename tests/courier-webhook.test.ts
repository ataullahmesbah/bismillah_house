import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { credentialsFor, getCourierAdapter } from "@/lib/courier/adapters";
import type { CourierCredentials } from "@/lib/courier/types";

/**
 * The webhook endpoint is the one part of the courier system anyone on the
 * internet can reach, and a forged "delivered" makes an unpaid order look
 * settled. These tests pin the checks that stop that.
 */

const SECRET = "test-webhook-secret";

const credentials: CourierCredentials = {
  baseUrl: "https://example.test",
  apiKey: "key",
  webhookSecret: SECRET,
};

const body = JSON.stringify({
  consignment_id: "CID-123",
  status: "delivered",
  updated_at: "2026-08-27T10:00:00Z",
  collected_amount: 2000,
});

function signed(payload: string, secret = SECRET): Headers {
  return new Headers({
    "x-steadfast-signature": createHmac("sha256", secret).update(payload, "utf8").digest("hex"),
  });
}

describe("courier webhook verification", () => {
  const adapter = getCourierAdapter("steadfast");

  it("accepts a correctly signed callback", () => {
    const result = adapter.parseWebhook(body, signed(body), credentials);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.consignmentId).toBe("CID-123");
      expect(result.step.status).toBe("DELIVERED");
      expect(result.collectedAmount).toBe(200_000); // taka → minor units
    }
  });

  it("rejects a callback signed with the wrong secret", () => {
    const result = adapter.parseWebhook(body, signed(body, "not-the-secret"), credentials);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("signature");
  });

  it("rejects an unsigned callback", () => {
    const result = adapter.parseWebhook(body, new Headers(), credentials);
    expect(result.ok).toBe(false);
  });

  /**
   * The attack this stops: sign a small body, then send a larger one with the
   * same signature. The HMAC covers the exact bytes, so any edit invalidates it.
   */
  it("rejects a body edited after signing", () => {
    const header = signed(body);
    const tampered = body.replace('"collected_amount":2000', '"collected_amount":1');
    expect(adapter.parseWebhook(tampered, header, credentials).ok).toBe(false);
  });

  /**
   * A courier configured without a webhook secret is refused rather than
   * trusted. An unauthenticated endpoint that can mark orders delivered is a
   * way to steal stock, so "not configured" must never mean "allow".
   */
  it("refuses everything when no webhook secret is configured", () => {
    const result = adapter.parseWebhook(body, signed(body), { ...credentials, webhookSecret: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("secret");
  });

  it("rejects a body that is not JSON, even correctly signed", () => {
    const junk = "not json at all";
    expect(adapter.parseWebhook(junk, signed(junk), credentials).ok).toBe(false);
  });

  it("rejects a payload with no consignment id", () => {
    const orphan = JSON.stringify({ status: "delivered" });
    const result = adapter.parseWebhook(orphan, signed(orphan), credentials);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("consignment");
  });

  /**
   * A status we do not recognise is refused rather than guessed at. Guessing
   * "delivered" from unfamiliar wording is exactly the mistake that would let
   * a parcel be marked delivered when it was not.
   */
  it("rejects wording it does not recognise instead of guessing", () => {
    const odd = JSON.stringify({ consignment_id: "CID-1", status: "quantum superposition" });
    const result = adapter.parseWebhook(odd, signed(odd), credentials);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("unrecognised");
  });

  it("refuses to act for a courier set to manual tracking", () => {
    const manual = getCourierAdapter("manual");
    expect(manual.supportsApi).toBe(false);
    expect(manual.parseWebhook(body, signed(body), credentials).ok).toBe(false);
  });

  it("falls back to manual for an unknown provider rather than throwing", () => {
    expect(getCourierAdapter("some-courier-we-never-wrote").key).toBe("manual");
    expect(getCourierAdapter(null).key).toBe("manual");
    expect(getCourierAdapter(undefined).key).toBe("manual");
  });
});

describe("courier credentials", () => {
  it("prefers the courier-specific variable over the shared one", () => {
    process.env.COURIER_BASE_URL = "https://shared.test";
    process.env.COURIER_API_KEY = "shared-key";
    process.env.COURIER_PATHAO_API_KEY = "pathao-key";

    expect(credentialsFor("PATHAO", null)?.apiKey).toBe("pathao-key");
    expect(credentialsFor("STEADFAST", null)?.apiKey).toBe("shared-key");

    delete process.env.COURIER_BASE_URL;
    delete process.env.COURIER_API_KEY;
    delete process.env.COURIER_PATHAO_API_KEY;
  });

  it("returns null when a courier has no key, so nothing pretends to be connected", () => {
    expect(credentialsFor("NOBODY", null)).toBeNull();
  });

  it("normalises a code with punctuation into a variable name", () => {
    process.env.COURIER_MY_COURIER_API_KEY = "k";
    process.env.COURIER_MY_COURIER_BASE_URL = "https://x.test";
    expect(credentialsFor("my-courier", null)?.apiKey).toBe("k");
    delete process.env.COURIER_MY_COURIER_API_KEY;
    delete process.env.COURIER_MY_COURIER_BASE_URL;
  });

  it("trims a trailing slash so paths do not double up", () => {
    process.env.COURIER_X_API_KEY = "k";
    expect(credentialsFor("X", "https://api.test/")?.baseUrl).toBe("https://api.test");
    delete process.env.COURIER_X_API_KEY;
  });
});
