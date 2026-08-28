import { describe, expect, it } from "vitest";

import { slugify, whatsappLink } from "@/lib/utils";
import { assistantKeywords } from "@/lib/services/ai-search";

describe("whatsappLink", () => {
  it("accepts the local form shop owners actually type", () => {
    expect(whatsappLink("01712345678")).toBe("https://wa.me/8801712345678");
    expect(whatsappLink("017 1234 5678")).toBe("https://wa.me/8801712345678");
    expect(whatsappLink("017-1234-5678")).toBe("https://wa.me/8801712345678");
  });

  it("accepts numbers that already carry the country code", () => {
    expect(whatsappLink("+8801712345678")).toBe("https://wa.me/8801712345678");
    expect(whatsappLink("8801712345678")).toBe("https://wa.me/8801712345678");
  });

  it("passes an existing https link through untouched", () => {
    expect(whatsappLink("https://wa.me/8801712345678")).toBe("https://wa.me/8801712345678");
  });

  it("refuses a plain-http link rather than downgrading the visitor", () => {
    expect(whatsappLink("http://wa.me/8801712345678")).toBeNull();
  });

  it("returns null for anything unusable, so the button is simply not shown", () => {
    expect(whatsappLink("")).toBeNull();
    expect(whatsappLink(null)).toBeNull();
    expect(whatsappLink(undefined)).toBeNull();
    expect(whatsappLink("   ")).toBeNull();
    expect(whatsappLink("call us")).toBeNull();
    expect(whatsappLink("12345")).toBeNull();
  });

  it("url-encodes the prefilled message", () => {
    const link = whatsappLink("01712345678", "Hello Trust Mart, I have a question about");
    expect(link).toContain("?text=Hello%20Trust%20Mart");
  });
});

describe("slugify", () => {
  it("keeps Bengali readable instead of stripping it to hyphens", () => {
    // Combining marks are part of the letter; dropping them turned খেজুর
    // into a row of separators.
    expect(slugify("খেজুর")).toBe("খেজুর");
    expect(slugify("প্রিমিয়াম খেজুর")).toBe("প্রিমিয়াম-খেজুর");
  });

  it("normalises Latin text", () => {
    expect(slugify("  Premium Ajwa Dates  ")).toBe("premium-ajwa-dates");
    expect(slugify("Men's Shoes — 43/44")).toBe("mens-shoes-43-44");
  });
});


describe("assistant search terms", () => {
  it("expands Banglish product words to what the catalogue is written in", () => {
    // "panjabi ache?" is how a shopper actually types it; the catalogue says
    // "Panjabi" or "Kurta" in English.
    const terms = assistantKeywords("panjabi ache?");
    expect(terms).toContain("panjabi");
    expect(terms).toContain("kurta");
  });

  it("expands Bangla script too", () => {
    expect(assistantKeywords("খেজুর দাম কত")).toContain("dates");
    expect(assistantKeywords("জুতা আছে")).toContain("shoes");
  });

  it("drops question words that are not products", () => {
    const terms = assistantKeywords("dam koto khejur");
    expect(terms).not.toContain("dam");
    expect(terms).not.toContain("koto");
    expect(terms).toContain("dates");
  });

  it("leaves a plain English query alone", () => {
    const terms = assistantKeywords("mustard oil price");
    expect(terms).toContain("mustard");
    expect(terms).toContain("oil");
  });
});
