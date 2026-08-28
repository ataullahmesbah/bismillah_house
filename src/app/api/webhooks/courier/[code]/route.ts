import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { credentialsFor, getCourierAdapter } from "@/lib/courier/adapters";
import { applyTracking } from "@/lib/services/courier";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Courier status callbacks.
 *
 * This endpoint is deliberately paranoid, because anyone on the internet can
 * POST to it and a forged "delivered" is a way to make an unpaid order look
 * settled:
 *
 *  - the signature is verified against a secret from the environment, and a
 *    courier configured without one is refused rather than trusted;
 *  - the consignment id must already exist on a shipment we created, so an
 *    attacker cannot invent one;
 *  - duplicate deliveries are absorbed (couriers retry), keyed on the event so
 *    the timeline does not fill with repeats;
 *  - the response is always 200 for anything we have processed or deliberately
 *    ignored — a courier that sees an error will retry forever, and the retries
 *    are indistinguishable from an attack.
 *
 * It never trusts the body for anything except the status word: which shipment,
 * which order and which customer all come from our own database.
 */

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Bound the damage from a flood; a real courier sends a handful per parcel.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await checkRateLimit("courierWebhook", ip);
  if (!limit.allowed) return Response.json({ ok: false }, { status: 429 });

  const courier = await prisma.courier.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true, code: true, name: true, provider: true, apiBaseUrl: true, isActive: true },
  });
  if (!courier || !courier.isActive) {
    return Response.json({ ok: false, error: "unknown courier" }, { status: 404 });
  }

  const credentials = credentialsFor(courier.code, courier.apiBaseUrl);
  if (!credentials) {
    console.warn(`[trust-mart] courier webhook for ${courier.code} rejected: no credentials configured`);
    return Response.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  // The raw text, not a parsed body: a signature covers the exact bytes sent,
  // and re-serialising a parsed object changes them.
  const rawBody = await request.text();
  const adapter = getCourierAdapter(courier.provider);
  const parsed = adapter.parseWebhook(rawBody, request.headers, credentials);

  if (!parsed.ok) {
    console.warn(`[trust-mart] courier webhook for ${courier.code} rejected: ${parsed.reason}`);
    // 401 for a bad signature so a misconfiguration is visible in their logs;
    // anything else is accepted-and-ignored so they stop retrying.
    const unauthorised = parsed.reason.includes("signature") || parsed.reason.includes("secret");
    return Response.json({ ok: false, error: parsed.reason }, { status: unauthorised ? 401 : 202 });
  }

  const shipment = await prisma.shipment.findFirst({
    where: {
      courierId: courier.id,
      OR: [{ consignmentId: parsed.consignmentId }, { trackingNumber: parsed.consignmentId }],
    },
    select: { id: true },
  });
  if (!shipment) {
    console.warn(`[trust-mart] courier webhook for ${courier.code}: unknown consignment ${parsed.consignmentId}`);
    return Response.json({ ok: true, ignored: "unknown consignment" }, { status: 202 });
  }

  // Couriers retry. Recording the event id makes a repeat a no-op rather than
  // a second "out for delivery" line on the customer's timeline.
  const eventKey = `${parsed.consignmentId}:${parsed.step.status}:${parsed.step.occurredAt.toISOString()}`;
  try {
    await prisma.webhookEvent.create({
      data: { provider: `courier:${courier.code}`, eventId: eventKey, payload: safeJson(rawBody) },
    });
  } catch {
    return Response.json({ ok: true, duplicate: true });
  }

  try {
    await applyTracking(shipment.id, [parsed.step], {
      source: "webhook",
      currentLocation: parsed.step.location,
      collectedAmount: parsed.collectedAmount ?? undefined,
      raw: safeJson(rawBody),
    });

    await prisma.webhookEvent.updateMany({
      where: { provider: `courier:${courier.code}`, eventId: eventKey },
      data: { processedAt: new Date() },
    });
  } catch (error) {
    // Left unprocessed on purpose: the row records that it arrived, and a
    // manual sync from the order screen can pick it up.
    console.error(`[trust-mart] courier webhook for ${courier.code} failed to apply`, error);
    return Response.json({ ok: false, error: "could not apply" }, { status: 500 });
  }

  return Response.json({ ok: true });
}

/** Stores the body only when it is JSON we can hold; otherwise a note. */
function safeJson(raw: string): object {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as object) : { value: parsed };
  } catch {
    return { unparsed: raw.slice(0, 2_000) };
  }
}
