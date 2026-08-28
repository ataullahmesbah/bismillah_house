import { NextRequest } from "next/server";

import { jsonOk, withApi } from "@/lib/api";
import { requireAnyPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createUploadSignature } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FOLDERS = new Set(["products", "categories", "brands", "banners", "site", "general", "variants"]);

/**
 * Issues a short-lived, server-signed Cloudinary upload token.
 * Only staff with a content permission can obtain one, and the folder is
 * validated against an allow-list so an arbitrary path cannot be injected.
 */
export const POST = withApi(async (request: NextRequest) => {
  const user = await requireAnyPermission([
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.BRAND_MANAGE,
    PERMISSIONS.BANNER_MANAGE,
    PERMISSIONS.CONTENT_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
  ]);

  await enforceRateLimit("upload", `user:${user.id}`);

  const requested = request.nextUrl.searchParams.get("folder") ?? "general";
  const folder = ALLOWED_FOLDERS.has(requested) ? requested : "general";

  return jsonOk(createUploadSignature(folder));
}, "uploadSign");
