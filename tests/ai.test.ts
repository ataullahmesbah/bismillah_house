import { describe, expect, it } from "vitest";

import { parsePayload } from "@/lib/ai/product-draft";

/**
 * The parser is the boundary between a language model and the product form.
 * Everything it returns has been through the shop's own clamps, because a
 * model's output is untrusted input like any other.
 */
describe("AI product draft parsing", () => {
  const minimal = JSON.stringify({ name: "Kabli Panjabi", suggestedPrice: 2400 });

  it("reads a plain JSON reply", () => {
    const payload = parsePayload(minimal);
    expect(payload.name).toBe("Kabli Panjabi");
    expect(payload.suggestedPrice).toBe(2400);
    expect(payload.slug).toBe("kabli-panjabi");
  });

  it("survives the code fence models add despite being told not to", () => {
    expect(parsePayload("```json\n" + minimal + "\n```").name).toBe("Kabli Panjabi");
    expect(parsePayload("```\n" + minimal + "\n```").name).toBe("Kabli Panjabi");
  });

  it("survives a sentence before the JSON", () => {
    expect(parsePayload(`Here is the listing you asked for:\n${minimal}`).name).toBe("Kabli Panjabi");
  });

  it("refuses a reply with no product name rather than creating a blank product", () => {
    expect(() => parsePayload(JSON.stringify({ shortDescription: "nice" }))).toThrow();
    expect(() => parsePayload("sorry, I cannot help with that")).toThrow();
    expect(() => parsePayload("")).toThrow();
  });

  /**
   * A hallucinated price is the field most likely to cost real money, so an
   * absurd one is dropped rather than clamped — the operator is then asked to
   * set it, instead of being shown a plausible-looking wrong number.
   */
  it("drops a price that cannot be real", () => {
    expect(parsePayload(JSON.stringify({ name: "X", suggestedPrice: 0 })).suggestedPrice).toBeNull();
    expect(parsePayload(JSON.stringify({ name: "X", suggestedPrice: -50 })).suggestedPrice).toBeNull();
    expect(parsePayload(JSON.stringify({ name: "X", suggestedPrice: 99_000_000 })).suggestedPrice).toBeNull();
    expect(parsePayload(JSON.stringify({ name: "X", suggestedPrice: "not a number" })).suggestedPrice).toBeNull();
  });

  it("accepts a price sent as a string, which models do", () => {
    expect(parsePayload(JSON.stringify({ name: "X", suggestedPrice: "2400" })).suggestedPrice).toBe(2400);
  });

  it("coerces a field that came back as the wrong type", () => {
    const payload = parsePayload(
      JSON.stringify({ name: "X", tags: "not-an-array", specifications: { label: "a" }, seoKeywords: null }),
    );
    expect(payload.tags).toEqual([]);
    expect(payload.specifications).toEqual([]);
    expect(payload.seoKeywords).toEqual([]);
  });

  it("drops half-filled specifications rather than showing an empty row", () => {
    const payload = parsePayload(
      JSON.stringify({
        name: "X",
        specifications: [
          { label: "Material", value: "Cotton" },
          { label: "Origin", value: "" },
          { value: "orphan" },
        ],
      }),
    );
    expect(payload.specifications).toEqual([{ label: "Material", value: "Cotton" }]);
  });

  it("caps the fields that feed length-limited columns", () => {
    const payload = parsePayload(
      JSON.stringify({
        name: "X".repeat(500),
        seoTitle: "T".repeat(200),
        shortDescription: "S".repeat(500),
        tags: Array.from({ length: 40 }, (_, index) => `tag-${index}`),
      }),
    );
    expect(payload.name.length).toBeLessThanOrEqual(200);
    expect(payload.seoTitle.length).toBeLessThanOrEqual(70);
    expect(payload.shortDescription.length).toBeLessThanOrEqual(200);
    expect(payload.tags.length).toBeLessThanOrEqual(8);
  });

  it("generates a slug and SKU when the model omits them", () => {
    const payload = parsePayload(JSON.stringify({ name: "Premium Basmati Rice 5kg" }));
    expect(payload.slug).toBe("premium-basmati-rice-5kg");
    expect(payload.sku).toBeTruthy();
  });

  it("keeps Bangla product names intact in the slug", () => {
    const payload = parsePayload(JSON.stringify({ name: "মিনিকেট চাল" }));
    expect(payload.name).toBe("মিনিকেট চাল");
    expect(payload.slug.length).toBeGreaterThan(0);
  });
});
