import "server-only";

/**
 * Bulk SMS delivery.
 *
 * Bangladeshi gateways (SSL Wireless, BulkSMSBD, Alpha Net and the rest) all
 * expose the same shape: an HTTP endpoint taking an API key, a recipient and a
 * message. Rather than commit to one, the request is described by environment
 * variables so the shop can move provider without a code change.
 *
 * With nothing configured the provider is `none`: messages are logged and
 * reported as undelivered, so a half-configured install fails loudly in the
 * logs rather than silently swallowing a customer's verification code.
 */

export type SmsResult = { delivered: boolean; provider: string; detail?: string };

function config() {
  return {
    provider: (process.env.SMS_PROVIDER ?? "none").toLowerCase(),
    endpoint: process.env.SMS_API_URL ?? "",
    apiKey: process.env.SMS_API_KEY ?? "",
    senderId: process.env.SMS_SENDER_ID ?? "",
    // Field names differ per gateway, so they are configurable too.
    toField: process.env.SMS_TO_FIELD ?? "to",
    messageField: process.env.SMS_MESSAGE_FIELD ?? "message",
    apiKeyField: process.env.SMS_API_KEY_FIELD ?? "api_key",
    senderIdField: process.env.SMS_SENDER_ID_FIELD ?? "senderid",
  };
}

/** True when a gateway is configured well enough to attempt a send. */
export function isSmsConfigured(): boolean {
  const { provider, endpoint, apiKey } = config();
  return provider !== "none" && Boolean(endpoint) && Boolean(apiKey);
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const { provider, endpoint, apiKey, senderId, toField, messageField, apiKeyField, senderIdField } = config();

  if (!isSmsConfigured()) {
    // Never log the message body: verification codes must not reach the logs.
    console.warn(`[trust-mart] SMS not sent to ${maskNumber(to)} — no provider configured`);
    return { delivered: false, provider: "none", detail: "No SMS provider configured." };
  }

  const body = new URLSearchParams({
    [apiKeyField]: apiKey,
    [toField]: to,
    [messageField]: message,
  });
  if (senderId) body.set(senderIdField, senderId);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { delivered: false, provider, detail: `Gateway returned ${response.status}` };
    }
    return { delivered: true, provider };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`[trust-mart] SMS send failed for ${maskNumber(to)}:`, detail);
    return { delivered: false, provider, detail };
  }
}

/** 017…1234 — enough to identify a number in a log without exposing it. */
function maskNumber(value: string): string {
  if (value.length < 7) return "***";
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}
