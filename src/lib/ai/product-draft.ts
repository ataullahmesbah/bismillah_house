import "server-only";

import { prisma } from "@/lib/db";
import { errors } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { slugify } from "@/lib/utils";
import { generateSku } from "@/lib/ids";
import { complete } from "./service";
import { AiUnavailableError } from "./types";

/**
 * AI-drafted products.
 *
 * The AI writes a draft. A person reads it, changes what they disagree with,
 * and presses publish. Nothing here creates a live product on its own, and the
 * one setting that would (`autoPublishDrafts`) is off and stays off unless the
 * owner turns it on deliberately.
 *
 * The generated payload is treated as untrusted input all the way through: it
 * is parsed defensively, every field is clamped to what the product form
 * accepts, and it is written to a draft table rather than to `products`.
 */

export type DraftPayload = {
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  specifications: Array<{ label: string; value: string }>;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  categorySuggestion: string;
  brandSuggestion: string;
  tags: string[];
  suggestedPrice: number | null;
  suggestedCompareAtPrice: number | null;
  attributes: Array<{ name: string; values: string[] }>;
  variantSuggestions: string[];
  imagePrompt: string;
  /** The model's own note about what it was unsure of. */
  reviewNotes: string;
};

const SYSTEM = `You write product listings for Trust Mart, an online shop in Bangladesh.

Rules, in order of importance:
1. Never invent a factual claim. If you do not know a product's specification,
   material, warranty or origin, leave the field empty rather than guessing.
   A wrong specification on a listing is a returned parcel and a lost customer.
2. Prices are in Bangladeshi taka. Suggest a price only if the product is a
   commodity whose local price you actually know; otherwise return null and say
   so in reviewNotes.
3. Write for a Bangladeshi shopper. Plain English, short sentences. Do not use
   marketing superlatives ("best ever", "amazing quality") — say what the thing
   is and what it does.
4. Do not claim delivery times, return windows, or payment options. Those are
   shop policy and are shown elsewhere on the page.
5. Return ONLY a JSON object matching the schema. No prose, no code fence.

Schema:
{
  "name": string,
  "slug": string (lowercase, hyphens),
  "sku": string,
  "shortDescription": string (max 200 chars),
  "description": string (2-4 short paragraphs, plain text),
  "specifications": [{ "label": string, "value": string }],
  "seoTitle": string (max 60 chars),
  "seoDescription": string (max 155 chars),
  "seoKeywords": string[] (max 10),
  "categorySuggestion": string,
  "brandSuggestion": string,
  "tags": string[] (max 8),
  "suggestedPrice": number | null (taka),
  "suggestedCompareAtPrice": number | null,
  "attributes": [{ "name": string, "values": string[] }],
  "variantSuggestions": string[],
  "imagePrompt": string (a prompt for an image generator),
  "reviewNotes": string (what you were unsure about — be honest)
}`;

export async function generateProductDraft(
  prompt: string,
  actorId: string,
): Promise<{ draftId: string; payload: DraftPayload }> {
  const settings = await getSettings();

  if (settings.ai.productMode === "manual") {
    throw errors.validation("AI product drafting is switched off. Turn it on in Settings → AI.");
  }

  const draft = await prisma.aiProductDraft.create({
    data: { prompt: prompt.slice(0, 2_000), status: "RUNNING", actorId },
    select: { id: true },
  });

  // Existing categories and brands, so the suggestion lands on one we have
  // rather than inventing a taxonomy nobody uses.
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, select: { name: true }, take: 60 }),
    prisma.brand.findMany({ where: { isActive: true }, select: { name: true }, take: 60 }),
  ]);

  const context = [
    `Shop: ${settings.site.siteName}`,
    categories.length > 0 ? `Existing categories: ${categories.map((c) => c.name).join(", ")}` : "",
    brands.length > 0 ? `Existing brands: ${brands.map((b) => b.name).join(", ")}` : "",
    "Prefer an existing category and brand when one fits.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await complete({
      actorId,
      request: {
        feature: "product_draft",
        system: `${SYSTEM}\n\n${context}`,
        // The request is wrapped so the model treats it as a description of a
        // product, not as instructions that could override the rules above.
        messages: [{ role: "user", content: `<product_request>\n${prompt.slice(0, 2_000)}\n</product_request>` }],
        maxTokens: 2_000,
        temperature: 0.5,
      },
    });

    const payload = parsePayload(response.text);

    await prisma.aiProductDraft.update({
      where: { id: draft.id },
      data: {
        status: "READY",
        provider: response.provider,
        model: response.model,
        payload: payload as unknown as object,
      },
    });

    return { draftId: draft.id, payload };
  } catch (error) {
    const message =
      error instanceof AiUnavailableError
        ? error.message
        : `Could not read the AI's reply: ${(error as Error).message}`;

    await prisma.aiProductDraft.update({
      where: { id: draft.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 500) },
    });

    throw errors.validation(`${message} You can still add this product by hand.`);
  }
}

/**
 * Turns whatever the model returned into a payload the form can render.
 *
 * Defensive throughout: models wrap JSON in fences despite being asked not to,
 * return numbers as strings, and occasionally return an object where an array
 * was asked for. None of that should reach the product form.
 */
export function parsePayload(raw: string): DraftPayload {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  // A model that adds a sentence before the JSON is common enough to handle.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in the reply");

  const parsed: unknown = JSON.parse(text.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object") throw new Error("reply was not an object");

  const record = parsed as Record<string, unknown>;

  const name = str(record.name, 200);
  if (!name) throw new Error("the reply had no product name");

  const specifications = arr(record.specifications)
    .map((entry) => {
      const spec = entry as Record<string, unknown>;
      return { label: str(spec.label, 60), value: str(spec.value, 200) };
    })
    .filter((spec) => spec.label && spec.value)
    .slice(0, 20);

  const attributes = arr(record.attributes)
    .map((entry) => {
      const attribute = entry as Record<string, unknown>;
      return {
        name: str(attribute.name, 60),
        values: arr(attribute.values).map((value) => str(value, 60)).filter(Boolean).slice(0, 20),
      };
    })
    .filter((attribute) => attribute.name && attribute.values.length > 0)
    .slice(0, 6);

  return {
    name,
    slug: slugify(str(record.slug, 200) || name),
    sku: str(record.sku, 60) || generateSku(["PRD", name]),
    shortDescription: str(record.shortDescription, 200),
    description: str(record.description, 5_000),
    specifications,
    seoTitle: str(record.seoTitle, 70),
    seoDescription: str(record.seoDescription, 200),
    seoKeywords: arr(record.seoKeywords).map((value) => str(value, 40)).filter(Boolean).slice(0, 10),
    categorySuggestion: str(record.categorySuggestion, 80),
    brandSuggestion: str(record.brandSuggestion, 80),
    tags: arr(record.tags).map((value) => str(value, 40)).filter(Boolean).slice(0, 8),
    suggestedPrice: money(record.suggestedPrice),
    suggestedCompareAtPrice: money(record.suggestedCompareAtPrice),
    attributes,
    variantSuggestions: arr(record.variantSuggestions).map((value) => str(value, 80)).filter(Boolean).slice(0, 20),
    imagePrompt: str(record.imagePrompt, 500),
    reviewNotes: str(record.reviewNotes, 1_000),
  };
}

function str(value: unknown, max: number): string {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number") return String(value).slice(0, max);
  return "";
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Taka as a number, refusing anything absurd rather than clamping silently. */
function money(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10_000_000) return null;
  return Math.round(parsed);
}
