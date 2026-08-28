import type { ShipmentStatus } from "@/generated/prisma/enums";

/**
 * The shape every courier adapter presents to the rest of the shop.
 *
 * Bangladeshi couriers each speak their own dialect of REST — Pathao wants a
 * store id and an OAuth token, Steadfast a pair of static headers, RedX
 * something else again — and none of that belongs anywhere near the order
 * screen. An adapter's job is to turn one of those dialects into these types
 * and nothing more.
 */

export type CourierCredentials = {
  baseUrl: string;
  apiKey: string;
  apiSecret?: string;
  /** Merchant/store identifier, where the courier needs one. */
  accountId?: string;
  webhookSecret?: string;
};

export type ParcelRequest = {
  orderNumber: string;
  /** Non-guessable token, used to build the webhook callback URL. */
  reference: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity?: string | null;
  recipientArea?: string | null;
  /** Cash to collect on delivery, in minor units. Zero for a prepaid order. */
  collectAmount: number;
  /** Declared value for insurance, in minor units. */
  itemValue: number;
  itemDescription: string;
  itemQuantity: number;
  weightGrams: number;
  note?: string | null;
};

export type ParcelResult = {
  /** The courier's parcel id. */
  consignmentId: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  /** Delivery charge quoted at creation, in minor units. */
  courierCharge?: number | null;
  estimatedDeliveryAt?: Date | null;
  status: ShipmentStatus;
  raw: unknown;
};

export type TrackingStep = {
  status: ShipmentStatus;
  description?: string | null;
  location?: string | null;
  occurredAt: Date;
  raw?: unknown;
};

export type TrackingResult = {
  status: ShipmentStatus;
  currentLocation?: string | null;
  deliveryManName?: string | null;
  deliveryManPhone?: string | null;
  estimatedDeliveryAt?: Date | null;
  deliveredAt?: Date | null;
  collectedAmount?: number | null;
  courierCharge?: number | null;
  steps: TrackingStep[];
  raw: unknown;
};

export type WebhookVerification =
  | { ok: true; consignmentId: string; step: TrackingStep; collectedAmount?: number | null }
  | { ok: false; reason: string };

export interface CourierAdapter {
  /** Matches `Courier.provider`. */
  readonly key: string;
  readonly label: string;
  /** False when this adapter cannot call out — the shop enters tracking by hand. */
  readonly supportsApi: boolean;

  createParcel(request: ParcelRequest, credentials: CourierCredentials): Promise<ParcelResult>;
  track(consignmentId: string, credentials: CourierCredentials): Promise<TrackingResult>;
  cancelParcel?(consignmentId: string, credentials: CourierCredentials): Promise<void>;

  /**
   * Verifies a webhook and pulls one tracking step out of it.
   *
   * Given the raw body and headers rather than a parsed object, because a
   * signature is computed over the exact bytes the courier sent — re-encoding
   * a parsed object changes them and the check fails for the wrong reason.
   */
  parseWebhook(rawBody: string, headers: Headers, credentials: CourierCredentials): WebhookVerification;
}

/** Courier wording → our status. Unknown wording is left for a human to read. */
export function mapStatusWord(word: string): ShipmentStatus | null {
  const text = word.toLowerCase().replace(/[_-]+/g, " ").trim();

  if (/(delivered|delivery complete|received by customer)/.test(text)) return "DELIVERED";
  if (/(out for delivery|on the way to customer|assigned to rider)/.test(text)) return "OUT_FOR_DELIVERY";
  if (/(at destination|destination hub|reached destination)/.test(text)) return "AT_DESTINATION";
  if (/(at hub|in hub|sorting|sorted)/.test(text)) return "AT_HUB";
  if (/(in transit|on the way|shipped)/.test(text)) return "IN_TRANSIT";
  if (/(picked|collected from merchant|pickup done)/.test(text)) return "PICKED";
  if (/(pickup pending|awaiting pickup|pickup requested)/.test(text)) return "PICKUP_PENDING";
  if (/(returned|return to merchant|rtm)/.test(text)) return "RETURNED";
  if (/(cancel)/.test(text)) return "CANCELLED";
  if (/(hold|on hold|postponed|rescheduled)/.test(text)) return "HOLD";
  if (/(failed|unreachable|refused|delivery attempt failed)/.test(text)) return "FAILED";
  if (/(created|booked|order placed|pending)/.test(text)) return "CREATED";
  return null;
}
