/**
 * Turning a shopper's question into catalogue search terms.
 *
 * Kept out of `ai.ts` so it carries no `server-only` import and can be tested
 * directly — the language handling here is the part most likely to need
 * adjusting as real questions come in.
 */

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "do", "does", "you", "have", "i", "want", "need",
  "for", "of", "in", "on", "with", "and", "or", "to", "me", "my", "can", "what",
  "how", "much", "price", "cost", "any", "please", "show", "tell", "about",
]);

/**
 * Bangla and Banglish words for things a shop sells, mapped to the English
 * the catalogue is written in.
 *
 * Shoppers here type all three ways — "পাঞ্জাবি", "panjabi", "panjabi ache?" —
 * and a plain substring search finds none of them against an English product
 * name. Each entry expands the query rather than replacing it, so an English
 * search keeps working exactly as before.
 */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  // Clothing
  panjabi: ["panjabi", "punjabi", "kurta"],
  পাঞ্জাবি: ["panjabi", "punjabi", "kurta"],
  jama: ["shirt", "clothing"],
  জামা: ["shirt", "clothing"],
  shari: ["saree", "sari"],
  শাড়ি: ["saree", "sari"],
  saree: ["saree", "sari"],
  jersey: ["jersey", "sports", "t-shirt"],
  জার্সি: ["jersey", "sports", "t-shirt"],
  tshirt: ["t-shirt", "shirt"],
  genji: ["t-shirt", "shirt"],
  গেঞ্জি: ["t-shirt", "shirt"],
  kapor: ["fashion", "clothing"],
  কাপড়: ["fashion", "clothing"],

  // Footwear
  juta: ["shoes", "footwear"],
  jutha: ["shoes", "footwear"],
  জুতা: ["shoes", "footwear"],
  sandal: ["sandal", "footwear"],
  স্যান্ডেল: ["sandal", "footwear"],

  // Grocery
  khejur: ["dates"],
  খেজুর: ["dates"],
  modhu: ["honey"],
  মধু: ["honey"],
  chal: ["rice"],
  চাল: ["rice"],
  tel: ["oil"],
  তেল: ["oil"],
  sorisha: ["mustard"],
  সরিষা: ["mustard"],
  masla: ["spice", "masala"],
  মসলা: ["spice", "masala"],

  // Home and beauty
  bason: ["cookware", "kitchen"],
  বাসন: ["cookware", "kitchen"],
  cream: ["cream", "beauty"],
  shopping: [],
};

/** Words that signal a question rather than a product. */
const INTENT_WORDS = new Set([
  "ache", "achhe", "asche", "dam", "koto", "kobe", "kivabe", "kemon", "pabo",
  "delivery", "price", "stock", "available", "আছে", "দাম", "কত", "কবে", "কিভাবে",
]);

export function assistantKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    // \p{M} matters: Bangla vowel signs are combining marks, not letters, so
    // stripping them shreds খেজুর into three one-character fragments that no
    // filter or synonym can match.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word) && !INTENT_WORDS.has(word));

  // Expand rather than replace, so an English query is unaffected.
  const expanded = new Set<string>();
  for (const word of words) {
    expanded.add(word);
    for (const synonym of SEARCH_SYNONYMS[word] ?? []) expanded.add(synonym);
  }

  return [...expanded].slice(0, 12);
}

