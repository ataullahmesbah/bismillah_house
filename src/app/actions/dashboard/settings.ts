"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { bulkDistrictSchema, districtSchema } from "@/lib/validation/commerce";
import { formDataList, formDataToObject } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { getSettings, saveSettingGroup, SETTINGS_DEFAULTS, type SettingsShape } from "@/lib/settings";
import { toMinor } from "@/lib/money";
import { COURIER_PROVIDERS } from "@/lib/courier/adapters";
import { formatMoney } from "@/lib/money";

/**
 * Business settings (PRD §25). Everything here is stored in PostgreSQL and
 * editable from the dashboard, so no source-code change is needed to rename the
 * shop, swap a tracking ID or change a delivery charge.
 *
 * Note: secret credentials (gateway keys, courier API secrets, AI keys) stay in
 * environment variables — this store is for non-secret configuration only.
 */

function readBool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readText(formData: FormData, key: string, fallback = ""): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}

/**
 * Reads a value that must be one of a fixed set.
 *
 * A select posts a plain string, and a hand-crafted request can post anything
 * at all, so the value is checked against the allowed list rather than cast.
 */
function readChoice<T extends string>(formData: FormData, key: string, allowed: readonly T[], fallback: T): T {
  const value = readText(formData, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Whole number inside a range, falling back rather than throwing. */
function clampInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function readOptional(formData: FormData, key: string): string | null {
  const value = readText(formData, key);
  return value.length > 0 ? value : null;
}

export async function saveSiteSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const current = await getSettings();

    const site: SettingsShape["site"] = {
      siteName: readText(formData, "siteName") || current.site.siteName,
      tagline: readText(formData, "tagline"),
      logoUrl: readOptional(formData, "logoUrl"),
      faviconUrl: readOptional(formData, "faviconUrl"),
      announcement: readText(formData, "announcement"),
      announcementEnabled: readBool(formData, "announcementEnabled"),
      announcementLink: readOptional(formData, "announcementLink"),
      footerAbout: readText(formData, "footerAbout"),
      copyright: readText(formData, "copyright") || current.site.copyright,
      currency: "BDT",
      timezone: readText(formData, "timezone") || "Asia/Dhaka",
    };

    const contact: SettingsShape["contact"] = {
      phone: readText(formData, "phone"),
      altPhone: readText(formData, "altPhone"),
      email: readText(formData, "email"),
      supportEmail: readText(formData, "supportEmail"),
      address: readText(formData, "address"),
      mapEmbedUrl: readOptional(formData, "mapEmbedUrl"),
      workingHours: readText(formData, "workingHours"),
    };

    const social: SettingsShape["social"] = {
      facebook: readText(formData, "facebook"),
      instagram: readText(formData, "instagram"),
      youtube: readText(formData, "youtube"),
      tiktok: readText(formData, "tiktok"),
      linkedin: readText(formData, "linkedin"),
      whatsapp: readText(formData, "whatsapp"),
    };

    await Promise.all([
      saveSettingGroup("site", site, user.id),
      saveSettingGroup("contact", contact, user.id),
      saveSettingGroup("social", social, user.id),
    ]);

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "settings",
      entityId: "site",
      summary: "Business settings updated",
      severity: "NOTICE",
    });

    revalidatePath("/", "layout");
    return actionSuccess("Business settings saved.");
  } catch (error) {
    return actionFailure(error, "saveSiteSettings");
  }
}

/** Colour and font choices, restricted to the values the tokens support. */
export async function saveThemeSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const before = await getSettings();

    const pick = <T extends string>(field: string, allowed: readonly T[], fallback: T): T => {
      const value = String(formData.get(field) ?? "");
      return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
    };

    const theme: SettingsShape["theme"] = {
      primaryColor: pick("primaryColor", ["graphite", "navy"] as const, "graphite"),
      secondaryColor: pick("secondaryColor", ["graphite", "navy", "accent"] as const, "navy"),
      fontFamily: pick("fontFamily", ["inter", "manrope", "notoSans"] as const, "inter"),
    };

    await saveSettingGroup("theme", theme, user.id);

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "setting",
      entityId: "theme",
      summary: "Updated look and feel",
      before: before.theme,
      after: theme,
    });

    // The tokens live in the root layout, so every page has to be refreshed.
    revalidatePath("/", "layout");
    return actionSuccess("Look and feel saved.");
  } catch (error) {
    return actionFailure(error, "saveThemeSettings");
  }
}

export async function saveFeatureSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const before = await getSettings();

    const features: SettingsShape["features"] = {
      // Both fields are still stored — the checkout code reads them — but the
      // dashboard asks one question, so they can no longer be set to
      // contradict each other.
      guestCheckoutEnabled: readText(formData, "checkoutAccess") !== "members",
      requireLoginForCheckout: readText(formData, "checkoutAccess") === "members",
      reviewsEnabled: readBool(formData, "reviewsEnabled"),
      requireDeliveredForReview: readBool(formData, "requireDeliveredForReview"),
      autoApproveReviews: readBool(formData, "autoApproveReviews"),
      chatbotEnabled: readBool(formData, "chatbotEnabled"),
      messagingEnabled: readBool(formData, "messagingEnabled"),
      popupAdsEnabled: readBool(formData, "popupAdsEnabled"),
      checkoutOtpEnabled: readBool(formData, "checkoutOtpEnabled"),
      maintenanceMode: readBool(formData, "maintenanceMode"),
      lowStockAlerts: readBool(formData, "lowStockAlerts"),
    };

    await saveSettingGroup("features", features, user.id);

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "settings",
      entityId: "features",
      summary: "Feature flags updated",
      before: before.features,
      after: features,
      severity: "WARNING",
    });

    revalidatePath("/", "layout");
    return actionSuccess("Feature flags saved.");
  } catch (error) {
    return actionFailure(error, "saveFeatureSettings");
  }
}

export async function saveSeoSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SEO_MANAGE);

    const seo: SettingsShape["seo"] = {
      defaultTitle: readText(formData, "defaultTitle") || SETTINGS_DEFAULTS.seo.defaultTitle,
      titleTemplate: readText(formData, "titleTemplate") || "%s | Trust Mart",
      defaultDescription: readText(formData, "defaultDescription"),
      defaultOgImage: readOptional(formData, "defaultOgImage"),
      keywords: readText(formData, "keywords"),
      robotsIndex: readBool(formData, "robotsIndex"),
      organizationName: readText(formData, "organizationName"),
      organizationLogo: readOptional(formData, "organizationLogo"),
      organizationSameAs: readText(formData, "organizationSameAs"),
      geoRegion: readText(formData, "geoRegion"),
      geoPlacename: readText(formData, "geoPlacename"),
      geoLatitude: readText(formData, "geoLatitude"),
      geoLongitude: readText(formData, "geoLongitude"),
    };

    await saveSettingGroup("seo", seo, user.id);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "settings",
      entityId: "seo",
      summary: "SEO settings updated",
    });

    revalidatePath("/", "layout");
    return actionSuccess("SEO settings saved.");
  } catch (error) {
    return actionFailure(error, "saveSeoSettings");
  }
}

export async function saveAnalyticsSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.ANALYTICS_MANAGE);

    const analytics: SettingsShape["analytics"] = {
      ga4MeasurementId: readText(formData, "ga4MeasurementId"),
      gtmContainerId: readText(formData, "gtmContainerId"),
      metaPixelId: readText(formData, "metaPixelId"),
      metaCapiEnabled: readBool(formData, "metaCapiEnabled"),
      metaCapiDatasetId: readText(formData, "metaCapiDatasetId"),
      requireConsent: readBool(formData, "requireConsent"),
      consentText: readText(formData, "consentText") || SETTINGS_DEFAULTS.analytics.consentText,
    };

    await saveSettingGroup("analytics", analytics, user.id);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "settings",
      entityId: "analytics",
      summary: "Analytics/tracking settings updated",
      severity: "NOTICE",
    });

    revalidatePath("/", "layout");
    return actionSuccess("Tracking settings saved. The Meta CAPI access token stays in your environment variables.");
  } catch (error) {
    return actionFailure(error, "saveAnalyticsSettings");
  }
}

export async function savePaymentSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

    const payment: SettingsShape["payment"] = {
      codEnabled: readBool(formData, "codEnabled"),
      bkashEnabled: readBool(formData, "bkashEnabled"),
      sslcommerzEnabled: readBool(formData, "sslcommerzEnabled"),
      codInstructions: readText(formData, "codInstructions"),
      bkashInstructions: readText(formData, "bkashInstructions"),
      bkashMerchantNumber: readText(formData, "bkashMerchantNumber"),
      minOrderAmount: toMinor(Number(readText(formData, "minOrderAmount", "0")) || 0),
    };

    if (!payment.codEnabled && !payment.bkashEnabled && !payment.sslcommerzEnabled) {
      throw errors.validation("At least one payment method must stay enabled.");
    }

    await saveSettingGroup("payment", payment, user.id);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "settings",
      entityId: "payment",
      summary: "Payment settings updated",
      severity: "WARNING",
    });

    revalidatePath("/", "layout");
    return actionSuccess("Payment settings saved.");
  } catch (error) {
    return actionFailure(error, "savePaymentSettings");
  }
}

/** Inventory and book-keeping defaults. */
export async function saveOperationsSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

    const inventory: SettingsShape["inventory"] = {
      defaultLowStockThreshold: clampInt(readText(formData, "defaultLowStockThreshold", "5"), 0, 10_000, 5),
      defaultReorderLevel: clampInt(readText(formData, "defaultReorderLevel", "10"), 0, 10_000, 10),
      lowStockBannerEnabled: readBool(formData, "lowStockBannerEnabled"),
      allowNegativeStock: readBool(formData, "allowNegativeStock"),
      showStockCountBelow: clampInt(readText(formData, "showStockCountBelow", "10"), 0, 1_000, 10),
      valuationBasis: readChoice(formData, "valuationBasis", ["cost", "retail"], "cost"),
      trackWarehouses: readBool(formData, "trackWarehouses"),
    };

    const finance: SettingsShape["finance"] = {
      fiscalYearStartMonth: clampInt(readText(formData, "fiscalYearStartMonth", "7"), 1, 12, 7),
      revenueRecognition: readChoice(formData, "revenueRecognition", ["on_order", "on_delivery"], "on_delivery"),
      trackCostOfGoods: readBool(formData, "trackCostOfGoods"),
      packagingCostPerOrder: toMinor(Number(readText(formData, "packagingCostPerOrder", "0")) || 0),
      defaultCashAccountCode: readText(formData, "defaultCashAccountCode") || "cash",
      defaultCourierAccountCode: readText(formData, "defaultCourierAccountCode") || "courier-receivable",
    };

    await saveSettingGroup("inventory", inventory, user.id);
    await saveSettingGroup("finance", finance, user.id);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "settings",
      entityId: "operations",
      summary: "Inventory and finance settings updated",
      severity: "WARNING",
    });

    revalidatePath("/", "layout");
    return actionSuccess("Inventory and finance settings saved.");
  } catch (error) {
    return actionFailure(error, "saveOperationsSettings");
  }
}

/**
 * Bot and identity checks on the sign-in forms.
 *
 * These are switches only — the keys they switch on live in the environment.
 * Turning one on without its keys is a no-op rather than a lockout, which is
 * why the page shows whether the keys are actually present.
 */
export async function saveSecuritySettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

    const security: SettingsShape["security"] = {
      turnstileEnabled: readBool(formData, "turnstileEnabled"),
      googleAuthEnabled: readBool(formData, "googleAuthEnabled"),
      turnstileOnLogin: readBool(formData, "turnstileOnLogin"),
      turnstileOnRegister: readBool(formData, "turnstileOnRegister"),
    };

    await saveSettingGroup("security", security, user.id);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "settings",
      entityId: "security",
      summary: `Turnstile ${security.turnstileEnabled ? "on" : "off"}, Google sign-in ${security.googleAuthEnabled ? "on" : "off"}`,
      severity: "CRITICAL",
    });

    revalidatePath("/", "layout");
    return actionSuccess("Sign-in security settings saved.");
  } catch (error) {
    return actionFailure(error, "saveSecuritySettings");
  }
}

export async function saveAiSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

    const ai: SettingsShape["ai"] = {
      enabled: readBool(formData, "aiEnabled"),
      assistantName: readText(formData, "assistantName") || "Trust Assistant",
      greeting: readText(formData, "greeting") || SETTINGS_DEFAULTS.ai.greeting,
      fallbackMessage: readText(formData, "fallbackMessage") || SETTINGS_DEFAULTS.ai.fallbackMessage,
      maxProductsInContext: Math.min(30, Math.max(3, Number(readText(formData, "maxProductsInContext", "12")) || 12)),
      productMode: readChoice(formData, "productMode", ["manual", "ai", "hybrid"], "manual"),
      primaryProvider: readChoice(formData, "primaryProvider", ["gemini", "openai", "anthropic"], "gemini"),
      geminiModel: readText(formData, "geminiModel") || SETTINGS_DEFAULTS.ai.geminiModel,
      openaiModel: readText(formData, "openaiModel") || SETTINGS_DEFAULTS.ai.openaiModel,
      anthropicModel: readText(formData, "anthropicModel") || SETTINGS_DEFAULTS.ai.anthropicModel,
      autoPublishDrafts: readBool(formData, "autoPublishDrafts"),
      monthlyRequestBudget: Math.max(0, Number(readText(formData, "monthlyRequestBudget", "500")) || 0),
    };

    await saveSettingGroup("ai", ai, user.id);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "settings",
      entityId: "ai",
      summary: "AI assistant settings updated",
    });

    revalidatePath("/", "layout");
    return actionSuccess("AI assistant settings saved.");
  } catch (error) {
    return actionFailure(error, "saveAiSettings");
  }
}

/* -------------------------------------------------------------------------- */
/* Delivery — 64 districts                                                     */
/* -------------------------------------------------------------------------- */

export async function saveShippingSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SHIPPING_MANAGE);
    const freeOver = readText(formData, "freeDeliveryOverAmount");

    const shipping: SettingsShape["shipping"] = {
      defaultCharge: toMinor(Number(readText(formData, "defaultCharge", "0")) || 0),
      freeDeliveryOverAmount: freeOver ? toMinor(Number(freeOver) || 0) : null,
      mixedCartStrategy: (["highest", "sum", "district_only"] as const).includes(
        readText(formData, "mixedCartStrategy") as never,
      )
        ? (readText(formData, "mixedCartStrategy") as SettingsShape["shipping"]["mixedCartStrategy"])
        : "highest",
      note: readText(formData, "note"),
    };

    await saveSettingGroup("shipping", shipping, user.id);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SHIPPING_CHANGED,
      entityType: "settings",
      entityId: "shipping",
      summary: `Delivery defaults updated (default ${formatMoney(shipping.defaultCharge)})`,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/settings/shipping");
    return actionSuccess("Delivery settings saved.");
  } catch (error) {
    return actionFailure(error, "saveShippingSettings");
  }
}

/** Per-district charge, free-delivery flag and availability. */
export async function saveDistrictAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SHIPPING_MANAGE);
    const input = districtSchema.parse(formDataToObject(formData));

    const district = await prisma.district.update({
      where: { id: input.id },
      data: {
        deliveryCharge: input.deliveryCharge,
        isFreeDelivery: input.isFreeDelivery,
        isActive: input.isActive,
        estimatedDays: input.estimatedDays,
      },
      select: { name: true },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SHIPPING_CHANGED,
      entityType: "district",
      entityId: input.id,
      summary: `${district.name}: ${input.isFreeDelivery ? "free delivery" : formatMoney(input.deliveryCharge)}`,
    });

    revalidatePath("/dashboard/settings/shipping");
    return actionSuccess(`${district.name} updated.`);
  } catch (error) {
    return actionFailure(error, "saveDistrict");
  }
}

/**
 * Bulk rule: set one charge for every district except the ones excluded
 * (typically Dhaka), then override individual districts afterwards.
 */
export async function bulkUpdateDistrictsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.SHIPPING_MANAGE);
    const input = bulkDistrictSchema.parse({
      ...formDataToObject(formData),
      excludeIds: formDataList(formData, "excludeIds"),
    });

    const result = await prisma.district.updateMany({
      where: {
        ...(input.excludeIds.length ? { id: { notIn: input.excludeIds } } : {}),
        ...(input.applyToInactive ? {} : { isActive: true }),
      },
      data: { deliveryCharge: input.defaultCharge, isFreeDelivery: false },
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SHIPPING_CHANGED,
      entityType: "district",
      summary: `Bulk set ${result.count} districts to ${formatMoney(input.defaultCharge)} (excluded ${input.excludeIds.length})`,
      severity: "WARNING",
    });

    revalidatePath("/dashboard/settings/shipping");
    return actionSuccess(`${result.count} districts updated.`);
  } catch (error) {
    return actionFailure(error, "bulkUpdateDistricts");
  }
}

/* -------------------------------------------------------------------------- */
/* Courier integrations                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Courier automation switches.
 *
 * The credentials are not here on purpose — those are environment variables,
 * so a database dump is not a set of courier accounts.
 */
export async function saveCourierSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COURIER_MANAGE);

    const courier: SettingsShape["courier"] = {
      autoDispatchOnConfirm: readBool(formData, "autoDispatchOnConfirm"),
      defaultCourierCode: readText(formData, "defaultCourierCode"),
      maxDispatchRetries: Math.min(10, Math.max(0, Number(readText(formData, "maxDispatchRetries", "3")) || 3)),
      autoPostSettlementToFinance: readBool(formData, "autoPostSettlementToFinance"),
      syncOrderStatusFromCourier: readBool(formData, "syncOrderStatusFromCourier"),
      customerTrackingEnabled: readBool(formData, "customerTrackingEnabled"),
    };

    await saveSettingGroup("courier", courier, user.id);
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "settings",
      entityId: "courier",
      summary: "Courier automation settings updated",
      severity: "WARNING",
    });

    revalidatePath("/dashboard/settings/courier");
    revalidatePath("/", "layout");
    return actionSuccess("Courier settings saved.");
  } catch (error) {
    return actionFailure(error, "saveCourierSettings");
  }
}

export async function saveCourierAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.COURIER_MANAGE);
    const id = String(formData.get("id") ?? "");

    const name = readText(formData, "name");
    const code = readText(formData, "code").toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!name || !code) throw errors.validation("Enter a courier name and code.");

    const data = {
      name,
      code,
      description: readOptional(formData, "description"),
      isActive: readBool(formData, "isActive"),
      provider: readChoice(formData, "provider", COURIER_PROVIDERS.map((p) => p.key), "manual"),
      apiBaseUrl: readOptional(formData, "apiBaseUrl"),
      trackingUrlTemplate: readOptional(formData, "trackingUrlTemplate"),
      defaultCharge: toMinor(Number(readText(formData, "defaultCharge", "0")) || 0),
      position: Number(readText(formData, "position", "0")) || 0,
    };

    const courier = id
      ? await prisma.courier.update({ where: { id }, data })
      : await prisma.courier.create({ data });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "courier",
      entityId: courier.id,
      summary: `${id ? "Updated" : "Added"} courier ${courier.name}`,
      severity: "NOTICE",
    });

    revalidatePath("/dashboard/settings/courier");
    return actionSuccess(
      "Courier saved. Add its API credentials to your environment variables — they are never stored in the database.",
    );
  } catch (error) {
    return actionFailure(error, "saveCourier");
  }
}

export async function deleteCourierAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.COURIER_MANAGE);
    const id = String(formData.get("id") ?? "");
    const inUse = await prisma.shipment.count({ where: { courierId: id } });
    if (inUse > 0) {
      await prisma.courier.update({ where: { id }, data: { isActive: false } });
      revalidatePath("/dashboard/settings/courier");
      return actionSuccess("This courier has shipments, so it was deactivated instead of deleted.");
    }
    await prisma.courier.delete({ where: { id } });
    revalidatePath("/dashboard/settings/courier");
    return actionSuccess("Courier removed.");
  } catch (error) {
    return actionFailure(error, "deleteCourier");
  }
}
