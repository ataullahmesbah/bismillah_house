"use server";

import { redirect } from "next/navigation";

import { actionFailure, type ActionState } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation/commerce";
import { formDataToObject } from "@/lib/validation/common";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getCurrentUser, requestContext } from "@/lib/auth/session";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { createOrder } from "@/lib/services/orders";
import { consumeVerification, sendVerificationCode, verifyCode } from "@/lib/services/phone-verification";
import { getSettings } from "@/lib/settings";
import { phoneSchema } from "@/lib/validation/common";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";

/**
 * Place an order.
 *
 * The browser supplies only *what* and *where* — every price, discount and
 * delivery charge is recalculated inside `createOrder` from database rows.
 */
export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let redirectTo: string | null = null;

  try {
    await enforceRateLimit("checkout");

    const input = checkoutSchema.parse(formDataToObject(formData));
    const user = await getCurrentUser();
    const { ip, userAgent } = await requestContext();

    // A saved address is only usable if it belongs to the signed-in customer.
    let resolved = {
      districtId: input.districtId,
      city: input.city,
      area: input.area,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      postalCode: input.postalCode,
      fullName: input.fullName,
      phone: input.phone,
    };

    if (input.addressId && user) {
      const address = await prisma.address.findFirst({
        where: { id: input.addressId, userId: user.id, deletedAt: null },
      });
      if (address) {
        resolved = {
          districtId: address.districtId ?? input.districtId,
          city: address.city,
          area: address.area,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          postalCode: address.postalCode,
          fullName: address.fullName,
          phone: address.phone,
        };
      }
    }

    /*
     * When the shop requires it, the number must carry a live verification —
     * and spending it here means one code cannot be reused for several
     * orders. Checked on the server: hiding the step in the UI would stop
     * nobody who posts the form directly.
     */
    const settings = await getSettings();
    if (settings.features.checkoutOtpEnabled) {
      await consumeVerification(resolved.phone);
    }

    const order = await createOrder({
      fullName: resolved.fullName,
      phone: resolved.phone,
      email: input.email,
      districtId: resolved.districtId,
      city: resolved.city,
      area: resolved.area,
      addressLine1: resolved.addressLine1,
      addressLine2: resolved.addressLine2,
      postalCode: resolved.postalCode,
      paymentMethod: input.paymentMethod,
      bkashTransactionId: input.bkashTransactionId,
      bkashSenderNumber: input.bkashSenderNumber,
      couponCode: input.couponCode,
      customerNote: input.customerNote,
      user,
      ipAddress: ip,
      userAgent,
    });

    if (input.saveAddress && user && !input.addressId) {
      const district = await prisma.district.findUnique({
        where: { id: resolved.districtId },
        select: { name: true },
      });
      const existingCount = await prisma.address.count({ where: { userId: user.id, deletedAt: null } });
      await prisma.address
        .create({
          data: {
            userId: user.id,
            fullName: resolved.fullName,
            phone: resolved.phone,
            districtId: resolved.districtId,
            districtName: district?.name ?? "",
            city: resolved.city,
            area: resolved.area,
            addressLine1: resolved.addressLine1,
            addressLine2: resolved.addressLine2,
            postalCode: resolved.postalCode,
            isDefault: existingCount === 0,
          },
        })
        .catch(() => undefined);
    }

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.ORDER_CREATED,
      entityType: "order",
      entityId: order.orderId,
      summary: `Order ${order.orderNumber} placed (${input.paymentMethod})`,
      severity: "NOTICE",
    });

    /*
     * createOrder empties the cart, but the pages built from it are cached:
     * without this the shopper can go back to a checkout still listing the
     * items they just bought, and the header badge keeps its old count.
     * The layout entry is what clears that badge, since the header lives
     * there rather than on any single page.
     */
    revalidatePath("/cart");
    revalidatePath("/checkout");
    revalidatePath("/", "layout");

    redirectTo = `/order-confirmation/${order.publicToken}`;
  } catch (error) {
    return actionFailure(error, "placeOrder");
  }

  // redirect() throws, so it must run outside the try/catch.
  redirect(redirectTo);
}


/** Sends a checkout verification code to the number the shopper entered. */
export async function requestCheckoutOtpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceRateLimit("checkoutOtp");

    const phone = phoneSchema.parse(formData.get("phone"));
    const settings = await getSettings();
    const { ip } = await requestContext();

    const result = await sendVerificationCode(phone, { shopName: settings.site.siteName, ipAddress: ip });

    if (!result.sent) {
      return {
        status: "error",
        message: result.detail ?? "We could not send the code. Please try again shortly.",
      };
    }

    return { status: "success", message: `Code sent to ${phone}. It expires in 10 minutes.` };
  } catch (error) {
    return actionFailure(error, "requestCheckoutOtp");
  }
}

/** Checks the code the shopper typed. */
export async function verifyCheckoutOtpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceRateLimit("checkoutOtp");

    const phone = phoneSchema.parse(formData.get("phone"));
    const code = String(formData.get("code") ?? "").trim();

    const result = await verifyCode(phone, code);
    if (!result.ok) return { status: "error", message: result.reason ?? "That code is not correct." };

    return { status: "success", message: "Number verified. You can place your order." };
  } catch (error) {
    return actionFailure(error, "verifyCheckoutOtp");
  }
}
