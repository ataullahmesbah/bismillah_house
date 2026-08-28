"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Cloudinary upload.
 *
 * The signature is fetched from our own server (`/api/uploads/sign`), so the
 * API secret never reaches the browser and the folder, type and size limits are
 * decided server-side. The upload itself goes straight to Cloudinary.
 */
export function ImageUploadField({
  name,
  label,
  defaultValue = "",
  folder = "general",
  recommendation,
  maxSizeMb = 5,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  folder?: string;
  recommendation?: string;
  maxSizeMb?: number;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [publicId, setPublicId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);

    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Use a JPG, PNG, WebP or AVIF image.");
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`That image is larger than ${maxSizeMb} MB.`);
      return;
    }

    setBusy(true);
    try {
      const signResponse = await fetch(`/api/uploads/sign?folder=${encodeURIComponent(folder)}`, { method: "POST" });
      const signJson = await signResponse.json();
      if (!signResponse.ok || !signJson.ok) {
        setError(signJson?.error ?? "Image uploads are not configured yet.");
        return;
      }

      const { cloudName, apiKey, timestamp, signature, folder: signedFolder, uploadUrl } = signJson.data;
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", apiKey);
      body.append("timestamp", String(timestamp));
      body.append("signature", signature);
      body.append("folder", signedFolder);

      const uploadResponse = await fetch(uploadUrl, { method: "POST", body });
      const uploadJson = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadJson.secure_url) {
        setError(uploadJson?.error?.message ?? "Upload failed. Please try again.");
        return;
      }

      setUrl(uploadJson.secure_url);
      setPublicId(uploadJson.public_id ?? "");
      void cloudName;
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={url} />
      <input type="hidden" name={`${name}PublicId`} value={publicId} />

      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-tm)] border border-line bg-surface-sunken">
          {url ? (
            <Image src={url} alt="" fill sizes="80px" className="object-contain" />
          ) : (
            <span className="flex h-full items-center justify-center text-[0.625rem] text-brand-400">No image</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="input py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <input
            type="url"
            className="input mt-2 text-xs"
            placeholder="…or paste an image URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          {recommendation ? <p className="form-hint mt-1">Recommended: {recommendation} · max {maxSizeMb} MB</p> : null}
          {busy ? <p className="form-hint mt-1">Uploading…</p> : null}
          {error ? <p className="form-error mt-1">{error}</p> : null}
          {url ? (
            <button type="button" className="btn-link mt-1 text-xs text-danger-600" onClick={() => { setUrl(""); setPublicId(""); }}>
              Remove image
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
