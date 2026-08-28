import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { SETTING_KEYS } from "@/lib/constants";

/**
 * Dashboard-editable configuration (PRD §25 "no-code business management").
 *
 * Every group has a typed shape and a default, so a fresh install works before
 * anything has been saved, and a partially filled group never breaks a page.
 * Secrets are NOT stored here — those stay in environment variables.
 */

export type {
  SiteSettings, ContactSettings, SocialSettings, FeatureSettings, SeoSettings,
  AnalyticsSettings, ShippingSettings, PaymentSettings, AiSettings, UploadSettings,
  InventorySettings, CourierSettings, FinanceSettings, SecuritySettings,
  SettingsShape,
} from "@/lib/settings-defaults";
export { SETTINGS_DEFAULTS } from "@/lib/settings-defaults";

import type { SettingsShape } from "@/lib/settings-defaults";
import { SETTINGS_DEFAULTS } from "@/lib/settings-defaults";

type Group = keyof SettingsShape;

const GROUP_KEYS: Record<Group, string> = {
  site: SETTING_KEYS.SITE,
  contact: SETTING_KEYS.CONTACT,
  social: SETTING_KEYS.SOCIAL,
  features: SETTING_KEYS.FEATURES,
  theme: SETTING_KEYS.THEME,
  seo: SETTING_KEYS.SEO,
  analytics: SETTING_KEYS.ANALYTICS,
  shipping: SETTING_KEYS.SHIPPING,
  payment: SETTING_KEYS.PAYMENT,
  ai: SETTING_KEYS.AI,
  inventory: SETTING_KEYS.INVENTORY,
  courier: SETTING_KEYS.COURIER,
  finance: SETTING_KEYS.FINANCE,
  security: SETTING_KEYS.SECURITY,
  upload: SETTING_KEYS.UPLOAD,
};

/**
 * Loads every settings group once per request. Missing rows fall back to the
 * defaults above, and stored values are merged over them so a newly added
 * field never renders as `undefined`.
 */
export const getSettings = cache(async (): Promise<SettingsShape> => {
  let rows: Array<{ key: string; value: unknown }> = [];
  try {
    rows = await prisma.setting.findMany({ select: { key: true, value: true } });
  } catch (error) {
    // The storefront must still render if the settings table is unreachable.
    console.error("[trust-mart] settings unavailable, using defaults", error);
  }

  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const result = {} as SettingsShape;
  for (const [group, key] of Object.entries(GROUP_KEYS) as Array<[Group, string]>) {
    const stored = byKey.get(key);
    const defaults = SETTINGS_DEFAULTS[group];
    result[group] = (
      stored && typeof stored === "object" && !Array.isArray(stored)
        ? { ...defaults, ...(stored as object) }
        : defaults
    ) as never;
  }
  return result;
});

export async function getSettingGroup<G extends Group>(group: G): Promise<SettingsShape[G]> {
  const settings = await getSettings();
  return settings[group];
}

/** Persists one group. Callers must have `settings.manage` (or the specific permission). */
export async function saveSettingGroup<G extends Group>(
  group: G,
  value: SettingsShape[G],
  updatedById?: string,
): Promise<void> {
  const key = GROUP_KEYS[group];
  const merged = { ...SETTINGS_DEFAULTS[group], ...value };
  await prisma.setting.upsert({
    where: { key },
    create: { key, group, value: merged as object, updatedById },
    update: { value: merged as object, updatedById },
  });
}
