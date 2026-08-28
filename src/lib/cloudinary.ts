import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/lib/env";
import { AppError } from "@/lib/api";
import { UPLOAD_DEFAULTS } from "@/lib/constants";

/**
 * Cloudinary uploads are *signed on the server* — the API secret never reaches
 * the browser, and the folder, allowed formats and size cap are fixed here so
 * a crafted client request cannot widen them.
 */

export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadUrl: string;
};

export function isCloudinaryConfigured(): boolean {
  return env.cloudinary.configured;
}

/** Cloudinary signs the alphabetically sorted parameter string with the API secret. */
export function createUploadSignature(folderSuffix = ""): UploadSignature {
  const { cloudName, apiKey, apiSecret, uploadFolder } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError("Image uploads are not configured. Add your Cloudinary credentials to .env.", {
      status: 503,
      code: "UPLOAD_NOT_CONFIGURED",
    });
  }

  const folder = folderSuffix ? `${uploadFolder}/${folderSuffix.replace(/[^a-z0-9/_-]/gi, "")}` : uploadFolder;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(`${params}${apiSecret}`).digest("hex");

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  };
}

export function validateUpload(fileType: string, fileSizeBytes: number, maxSizeMb: number): void {
  if (!UPLOAD_DEFAULTS.acceptedFormats.includes(fileType as (typeof UPLOAD_DEFAULTS.acceptedFormats)[number])) {
    throw new AppError(`Unsupported image type. Use ${UPLOAD_DEFAULTS.acceptedFormats.join(", ")}.`, {
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  }
  if (fileSizeBytes > maxSizeMb * 1024 * 1024) {
    throw new AppError(`Image is too large. The maximum size is ${maxSizeMb} MB.`, {
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
  }
}

/** Deletes an asset using the signed destroy endpoint. Best-effort. */
export async function destroyAsset(publicId: string): Promise<boolean> {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) return false;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_id: publicId, timestamp, api_key: apiKey, signature }),
    });
    return response.ok;
  } catch (error) {
    console.error("[trust-mart] cloudinary destroy failed", error);
    return false;
  }
}

/**
 * Adds Cloudinary transformations to a delivery URL so the browser receives a
 * right-sized, auto-format (WebP/AVIF) image.
 */
export function optimizedImage(url: string | null | undefined, width = 800): string | null {
  if (!url) return null;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}
