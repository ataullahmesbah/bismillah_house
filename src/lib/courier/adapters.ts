import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { errors } from "@/lib/api";
import type {
  CourierAdapter,
  CourierCredentials,
  ParcelRequest,
  ParcelResult,
  TrackingResult,
  TrackingStep,
  WebhookVerification,
} from "./types";
import { mapStatusWord } from "./types";

/**
 * Courier adapters.
 *
 * Every Bangladeshi courier that offers an API offers roughly the same one:
 * POST a parcel, GET a status, receive a webhook. The differences are field
 * names, auth headers and how the status is spelt. So there is one HTTP
 * implementation here and the per-courier parts are data.
 *
 * Nothing here reads a key from the database. Credentials come from the
 * environment, keyed by courier code, so a database dump is not a set of
 * courier accounts.
 */

const TIMEOUT_MS = 15_000;

type FieldMap = {
  /** Path appended to the base URL for each operation. */
  createPath: string;
  trackPath: (consignmentId: string) => string;
  cancelPath?: (consignmentId: string) => string;
  auth: (credentials: CourierCredentials) => Record<string, string>;
  body: (request: ParcelRequest, credentials: CourierCredentials) => Record<string, unknown>;
  /** Pulls the courier's ids out of whatever envelope it wrapped them in. */
  readCreate: (payload: JsonRecord) => { consignmentId: string; trackingNumber: string; charge: number | null };
  readTrack: (payload: JsonRecord) => TrackingResult;
  /** Header carrying the webhook signature, if the courier signs at all. */
  signatureHeader?: string;
};

type JsonRecord = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reads `a.b.c` out of a nested payload without throwing on a missing branch. */
function dig(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") return (current as JsonRecord)[key];
    return undefined;
  }, payload);
}

/** Takes at most `taka × 100`; couriers quote whole taka, we store minor units. */
function takaToMinor(value: unknown): number | null {
  const parsed = num(value);
  return parsed === null ? null : Math.round(parsed * 100);
}

function minorToTaka(minor: number): number {
  return Math.round(minor) / 100;
}

async function call(
  url: string,
  init: RequestInit,
): Promise<{ status: number; payload: JsonRecord; text: string }> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    // A timeout or DNS failure is not the shop's fault and must not look like
    // a rejected parcel — the caller retries this, but not a 4xx.
    throw errors.upstream(`Could not reach the courier: ${(error as Error).message}`);
  }

  const text = await response.text();
  let payload: JsonRecord = {};
  try {
    payload = text ? (JSON.parse(text) as JsonRecord) : {};
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, payload, text };
}

function buildAdapter(key: string, label: string, map: FieldMap): CourierAdapter {
  return {
    key,
    label,
    supportsApi: true,

    async createParcel(request: ParcelRequest, credentials: CourierCredentials): Promise<ParcelResult> {
      const { status, payload, text } = await call(`${credentials.baseUrl}${map.createPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...map.auth(credentials) },
        body: JSON.stringify(map.body(request, credentials)),
      });

      if (status >= 400) {
        throw errors.validation(
          `${label} rejected the parcel (HTTP ${status}). ${str(payload.message) || text.slice(0, 200)}`,
        );
      }

      const read = map.readCreate(payload);
      if (!read.consignmentId && !read.trackingNumber) {
        throw errors.validation(`${label} accepted the request but returned no tracking number.`);
      }

      return {
        consignmentId: read.consignmentId || read.trackingNumber,
        trackingNumber: read.trackingNumber || read.consignmentId,
        courierCharge: read.charge,
        status: "CREATED",
        raw: payload,
      };
    },

    async track(consignmentId: string, credentials: CourierCredentials): Promise<TrackingResult> {
      const { status, payload } = await call(`${credentials.baseUrl}${map.trackPath(consignmentId)}`, {
        method: "GET",
        headers: { Accept: "application/json", ...map.auth(credentials) },
      });
      if (status >= 400) throw errors.validation(`${label} could not find parcel ${consignmentId}.`);
      return map.readTrack(payload);
    },

    async cancelParcel(consignmentId: string, credentials: CourierCredentials): Promise<void> {
      if (!map.cancelPath) throw errors.validation(`${label} does not support cancelling through the API.`);
      const { status } = await call(`${credentials.baseUrl}${map.cancelPath(consignmentId)}`, {
        method: "POST",
        headers: { Accept: "application/json", ...map.auth(credentials) },
      });
      if (status >= 400) throw errors.validation(`${label} refused to cancel parcel ${consignmentId}.`);
    },

    parseWebhook(rawBody: string, headers: Headers, credentials: CourierCredentials): WebhookVerification {
      if (map.signatureHeader && credentials.webhookSecret) {
        const provided = headers.get(map.signatureHeader) ?? "";
        if (!verifySignature(rawBody, provided, credentials.webhookSecret)) {
          return { ok: false, reason: "signature mismatch" };
        }
      } else if (map.signatureHeader && !credentials.webhookSecret) {
        // Refusing beats accepting: an unauthenticated endpoint that moves
        // orders to Delivered is a way to steal stock, not a convenience.
        return { ok: false, reason: "webhook secret not configured" };
      }

      let payload: JsonRecord;
      try {
        payload = JSON.parse(rawBody) as JsonRecord;
      } catch {
        return { ok: false, reason: "body is not JSON" };
      }

      const consignmentId =
        str(payload.consignment_id) || str(payload.consignmentId) || str(payload.tracking_code) ||
        str(payload.invoice) || str(dig(payload, "data.consignment_id"));
      if (!consignmentId) return { ok: false, reason: "no consignment id in payload" };

      const word =
        str(payload.status) || str(payload.delivery_status) || str(payload.event) ||
        str(dig(payload, "data.status"));
      const status = mapStatusWord(word);
      if (!status) return { ok: false, reason: `unrecognised status "${word}"` };

      const step: TrackingStep = {
        status,
        description: str(payload.message) || str(payload.note) || word,
        location: str(payload.hub) || str(payload.location) || null,
        occurredAt: parseDate(payload.updated_at ?? payload.timestamp ?? payload.time) ?? new Date(),
        raw: payload,
      };

      return {
        ok: true,
        consignmentId,
        step,
        collectedAmount: takaToMinor(payload.collected_amount ?? payload.cod_amount),
      };
    },
  };
}

/**
 * Constant-time signature comparison.
 *
 * `===` on a hex string leaks how many leading characters matched through its
 * timing, which is enough to forge a signature byte by byte given patience.
 */
function verifySignature(body: string, provided: string, secret: string): boolean {
  if (!provided) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided.replace(/^sha256=/i, "").trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function readStepsFrom(payload: unknown, path: string): TrackingStep[] {
  const list = dig(payload, path);
  if (!Array.isArray(list)) return [];
  return list
    .map((entry): TrackingStep | null => {
      const record = entry as JsonRecord;
      const status = mapStatusWord(str(record.status) || str(record.message_en) || str(record.event));
      if (!status) return null;
      return {
        status,
        description: str(record.message_en) || str(record.message) || str(record.status),
        location: str(record.hub) || str(record.location) || null,
        occurredAt: parseDate(record.time ?? record.updated_at ?? record.created_at) ?? new Date(),
        raw: record,
      };
    })
    .filter((step): step is TrackingStep => step !== null);
}

/* -------------------------------------------------------------------------- */

const steadfast = buildAdapter("steadfast", "Steadfast", {
  createPath: "/create_order",
  trackPath: (id) => `/status_by_cid/${encodeURIComponent(id)}`,
  signatureHeader: "x-steadfast-signature",
  auth: (credentials) => ({
    "Api-Key": credentials.apiKey,
    "Secret-Key": credentials.apiSecret ?? "",
  }),
  body: (request) => ({
    invoice: request.orderNumber,
    recipient_name: request.recipientName,
    recipient_phone: request.recipientPhone,
    recipient_address: request.recipientAddress,
    cod_amount: minorToTaka(request.collectAmount),
    note: request.note ?? "",
    item_description: request.itemDescription,
    total_lot: request.itemQuantity,
    delivery_type: 0,
  }),
  readCreate: (payload) => ({
    consignmentId: str(dig(payload, "consignment.consignment_id")),
    trackingNumber: str(dig(payload, "consignment.tracking_code")),
    charge: takaToMinor(dig(payload, "consignment.delivery_fee")),
  }),
  readTrack: (payload) => ({
    status: mapStatusWord(str(payload.delivery_status)) ?? "IN_TRANSIT",
    steps: readStepsFrom(payload, "tracking"),
    collectedAmount: takaToMinor(payload.cod_amount),
    raw: payload,
  }),
});

const pathao = buildAdapter("pathao", "Pathao Courier", {
  createPath: "/aladdin/api/v1/orders",
  trackPath: (id) => `/aladdin/api/v1/orders/${encodeURIComponent(id)}/info`,
  signatureHeader: "x-pathao-signature",
  auth: (credentials) => ({
    Authorization: `Bearer ${credentials.apiKey}`,
    ...(credentials.accountId ? { "X-Store-Id": credentials.accountId } : {}),
  }),
  body: (request, credentials) => ({
    store_id: credentials.accountId,
    merchant_order_id: request.orderNumber,
    recipient_name: request.recipientName,
    recipient_phone: request.recipientPhone,
    recipient_address: request.recipientAddress,
    recipient_city: request.recipientCity,
    recipient_area: request.recipientArea,
    delivery_type: 48,
    item_type: 2,
    item_quantity: request.itemQuantity,
    item_weight: Math.max(0.5, request.weightGrams / 1000),
    amount_to_collect: minorToTaka(request.collectAmount),
    item_description: request.itemDescription,
    special_instruction: request.note ?? "",
  }),
  readCreate: (payload) => ({
    consignmentId: str(dig(payload, "data.consignment_id")),
    trackingNumber: str(dig(payload, "data.consignment_id")),
    charge: takaToMinor(dig(payload, "data.delivery_fee")),
  }),
  readTrack: (payload) => ({
    status: mapStatusWord(str(dig(payload, "data.order_status"))) ?? "IN_TRANSIT",
    currentLocation: str(dig(payload, "data.current_hub")) || null,
    steps: readStepsFrom(payload, "data.order_status_history"),
    collectedAmount: takaToMinor(dig(payload, "data.collected_amount")),
    courierCharge: takaToMinor(dig(payload, "data.delivery_fee")),
    raw: payload,
  }),
});

const redx = buildAdapter("redx", "RedX", {
  createPath: "/v1/parcels",
  trackPath: (id) => `/v1/parcels/track/${encodeURIComponent(id)}`,
  signatureHeader: "x-redx-signature",
  auth: (credentials) => ({ "API-ACCESS-TOKEN": `Bearer ${credentials.apiKey}` }),
  body: (request) => ({
    customer_name: request.recipientName,
    customer_phone: request.recipientPhone,
    delivery_area: request.recipientArea,
    customer_address: request.recipientAddress,
    merchant_invoice_id: request.orderNumber,
    cash_collection_amount: String(minorToTaka(request.collectAmount)),
    parcel_weight: Math.max(500, request.weightGrams),
    value: minorToTaka(request.itemValue),
    instruction: request.note ?? "",
  }),
  readCreate: (payload) => ({
    consignmentId: str(payload.tracking_id),
    trackingNumber: str(payload.tracking_id),
    charge: null,
  }),
  readTrack: (payload) => ({
    status: mapStatusWord(str(dig(payload, "parcel.status"))) ?? "IN_TRANSIT",
    steps: readStepsFrom(payload, "tracking"),
    raw: payload,
  }),
});

/**
 * The fallback for a courier with no API, or one whose credentials are absent.
 *
 * It refuses rather than pretending: a shop that has not configured Pathao must
 * be told to enter the tracking number by hand, not shown a parcel that does
 * not exist.
 */
const manual: CourierAdapter = {
  key: "manual",
  label: "Manual tracking",
  supportsApi: false,
  async createParcel(): Promise<ParcelResult> {
    throw errors.validation(
      "This courier has no API connected. Enter the tracking number from their dashboard instead.",
    );
  },
  async track(): Promise<TrackingResult> {
    throw errors.validation("This courier has no API connected, so status cannot be fetched automatically.");
  },
  parseWebhook(): WebhookVerification {
    return { ok: false, reason: "this courier is set to manual tracking" };
  },
};

const ADAPTERS: Record<string, CourierAdapter> = {
  steadfast,
  pathao,
  redx,
  manual,
};

export function getCourierAdapter(provider: string | null | undefined): CourierAdapter {
  return ADAPTERS[(provider ?? "manual").toLowerCase()] ?? manual;
}

export const COURIER_PROVIDERS = Object.values(ADAPTERS).map((adapter) => ({
  key: adapter.key,
  label: adapter.label,
  supportsApi: adapter.supportsApi,
}));

/**
 * Credentials for one courier, read from the environment by its code.
 *
 * `COURIER_PATHAO_API_KEY` and friends, falling back to the single generic
 * `COURIER_*` set so a shop using one courier need not repeat its code.
 */
export function credentialsFor(code: string, apiBaseUrl: string | null): CourierCredentials | null {
  const upper = code.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const read = (suffix: string) =>
    process.env[`COURIER_${upper}_${suffix}`] || process.env[`COURIER_${suffix}`] || "";

  const baseUrl = apiBaseUrl || read("BASE_URL");
  const apiKey = read("API_KEY");
  if (!baseUrl || !apiKey) return null;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    apiSecret: read("API_SECRET") || undefined,
    accountId: read("ACCOUNT_ID") || read("STORE_ID") || undefined,
    webhookSecret: read("WEBHOOK_SECRET") || undefined,
  };
}
