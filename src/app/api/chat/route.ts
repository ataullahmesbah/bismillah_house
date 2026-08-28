import { NextRequest } from "next/server";
import { z } from "zod";

import { jsonError, jsonOk, withApi } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { askAssistant } from "@/lib/services/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question: z.string().trim().min(1, "Ask a question.").max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(10)
    .default([]),
});

/**
 * AI shopping assistant endpoint.
 * Rate limited per IP, grounded in approved catalogue data, and safe to call
 * even when no AI provider is configured.
 */
export const POST = withApi(async (request: NextRequest) => {
  await enforceRateLimit("chatbot");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(new Error("Invalid request body."), "chat");
  }

  const { question, history } = bodySchema.parse(payload);
  const reply = await askAssistant(history, question);
  return jsonOk(reply);
}, "chat");
