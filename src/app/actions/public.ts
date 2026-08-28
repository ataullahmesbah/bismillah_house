"use server";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { contactSchema, trackOrderSchema } from "@/lib/validation/commerce";
import { formDataToObject } from "@/lib/validation/common";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { getSettingGroup } from "@/lib/settings";

/** Contact form — rate limited and stored as a lead for the dashboard. */
export async function submitContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceRateLimit("contact");
    const input = contactSchema.parse(formDataToObject(formData));
    const { ip } = await requestContext();

    await prisma.contactLead.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        subject: input.subject,
        message: input.message,
        ipAddress: ip,
      },
    });

    await notify({
      audience: "STAFF",
      type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      title: `New contact message: ${input.subject}`,
      body: `${input.name} • ${input.email}`,
      url: "/dashboard/messages/leads",
    });

    return actionSuccess("Thanks — we have received your message and will reply soon.");
  } catch (error) {
    return actionFailure(error, "submitContact");
  }
}

export type TrackedOrder = {
  orderNumber: string;
  publicToken: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  placedAt: string;
  grandTotal: number;
  districtName: string | null;
  estimatedDays: string | null;
  timeline: Array<{ status: string; note: string | null; at: string }>;
  shipment: {
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: string;
    currentLocation: string | null;
    estimatedDeliveryAt: string | null;
    deliveredAt: string | null;
    /** Newest first, so the page reads top-down like a courier's own site. */
    steps: Array<{ status: string; description: string | null; location: string | null; at: string }>;
  } | null;
  items: Array<{ name: string; variantName: string | null; quantity: number; total: number }>;
};

export type TrackOrderState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Record<string, string> }
  | { status: "success"; order: TrackedOrder };

/**
 * Public order tracking.
 *
 * Requires the order number (or the non-guessable public token) *and* the
 * phone number on the order. Knowing an order number alone is never enough.
 */
export async function trackOrderAction(_prev: TrackOrderState, formData: FormData): Promise<TrackOrderState> {
  try {
    await enforceRateLimit("search");
    const input = trackOrderSchema.parse(formDataToObject(formData));
    const reference = input.reference.trim();
    const phoneDigits = input.phone.replace(/\D/g, "");

    const order = await prisma.order.findFirst({
      where: {
        deletedAt: null,
        OR: [{ orderNumber: reference.toUpperCase() }, { publicToken: reference }],
      },
      select: {
        orderNumber: true, publicToken: true, status: true, paymentStatus: true, paymentMethod: true,
        placedAt: true, grandTotal: true, districtName: true, customerPhone: true,
        district: { select: { estimatedDays: true } },
        statusEvents: { orderBy: { createdAt: "asc" }, select: { toStatus: true, note: true, createdAt: true } },
        shipments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            courierName: true, trackingNumber: true, trackingUrl: true, status: true,
            currentLocation: true, estimatedDeliveryAt: true, deliveredAt: true,
            events: {
              orderBy: { occurredAt: "desc" },
              take: 30,
              select: { status: true, description: true, location: true, occurredAt: true },
            },
          },
        },
        items: { select: { productName: true, variantName: true, quantity: true, lineTotal: true } },
      },
    });

    // One generic message for "not found" and "wrong phone" so the endpoint
    // cannot be used to confirm that an order number exists.
    const orderPhoneDigits = order?.customerPhone.replace(/\D/g, "") ?? "";
    if (!order || !orderPhoneDigits.endsWith(phoneDigits.slice(-6)) || phoneDigits.length < 6) {
      throw errors.notFound("We could not find an order matching those details. Please check and try again.");
    }

    const parcel = order.shipments[0] ?? null;
    // The shop may keep courier detail out of the customer's view.
    const showTracking = (await getSettingGroup("courier")).customerTrackingEnabled;

    return {
      status: "success",
      order: {
        orderNumber: order.orderNumber,
        publicToken: order.publicToken,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        placedAt: order.placedAt.toISOString(),
        grandTotal: order.grandTotal,
        districtName: order.districtName,
        estimatedDays: order.district?.estimatedDays ?? null,
        timeline: order.statusEvents.map((event) => ({
          status: event.toStatus,
          note: event.note,
          at: event.createdAt.toISOString(),
        })),
        shipment:
          parcel && showTracking
            ? {
                courierName: parcel.courierName,
                trackingNumber: parcel.trackingNumber,
                trackingUrl: parcel.trackingUrl,
                status: parcel.status,
                currentLocation: parcel.currentLocation,
                estimatedDeliveryAt: parcel.estimatedDeliveryAt?.toISOString() ?? null,
                deliveredAt: parcel.deliveredAt?.toISOString() ?? null,
                steps: parcel.events.map((event) => ({
                  status: event.status,
                  description: event.description,
                  location: event.location,
                  at: event.occurredAt.toISOString(),
                })),
              }
            : null,
        items: order.items.map((item) => ({
          name: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          total: item.lineTotal,
        })),
      },
    };
  } catch (error) {
    const failure = actionFailure(error, "trackOrder");
    return { status: "error", message: failure.status === "error" ? failure.message : "Something went wrong.", fields: failure.status === "error" ? failure.fields : undefined };
  }
}
