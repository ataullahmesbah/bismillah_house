import "server-only";

import { prisma } from "@/lib/db";
import { getSettingGroup } from "@/lib/settings";
import { getAiProvider } from "./providers";
import { AiUnavailableError, type AiProviderKey, type AiRequest, type AiResponse } from "./types";

/**
 * The entry point every AI feature goes through.
 *
 * Two things happen here that must not be scattered across callers.
 *
 * Fallback: the configured provider is tried first, then the others in turn.
 * A shop on a free tier will hit its quota, and hitting it should degrade to
 * the next provider — or to manual entry — rather than stopping work.
 *
 * Logging: every call records what it cost and whether it worked, so "the AI
 * stopped working" is answerable without guessing. The prompt is deliberately
 * not stored: it can carry a draft product description someone is still
 * working on, and a log table is the wrong place for that.
 */

export type CompleteOptions = {
  request: AiRequest;
  actorId?: string | null;
  /** Skip the fallback chain and fail if this provider cannot serve. */
  onlyProvider?: AiProviderKey;
};

const MODEL_FOR: Record<AiProviderKey, keyof Awaited<ReturnType<typeof getSettingGroup<"ai">>>> = {
  gemini: "geminiModel",
  openai: "openaiModel",
  anthropic: "anthropicModel",
};

export async function complete(options: CompleteOptions): Promise<AiResponse> {
  const settings = await getSettingGroup("ai");

  if (!settings.enabled) throw new AiUnavailableError("AI features are switched off in settings.");

  const order: AiProviderKey[] = options.onlyProvider
    ? [options.onlyProvider]
    : [settings.primaryProvider, ...(["gemini", "openai", "anthropic"] as AiProviderKey[])].filter(
        (key, index, all) => all.indexOf(key) === index,
      );

  const failures: string[] = [];

  for (const providerKey of order) {
    const provider = getAiProvider(providerKey);
    if (!provider.isConfigured()) {
      failures.push(`${provider.label}: no API key`);
      continue;
    }

    const model = String(settings[MODEL_FOR[providerKey]] ?? "");

    try {
      const response = await provider.complete(options.request, model);
      await log({
        provider: providerKey,
        model,
        feature: options.request.feature,
        promptTokens: response.promptTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
        success: true,
        actorId: options.actorId ?? null,
      });
      return response;
    } catch (error) {
      const message = (error as Error).message;
      failures.push(`${provider.label}: ${message}`);
      await log({
        provider: providerKey,
        model,
        feature: options.request.feature,
        promptTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        success: false,
        errorMessage: message.slice(0, 500),
        actorId: options.actorId ?? null,
      });
    }
  }

  throw new AiUnavailableError(
    failures.length > 0
      ? `No AI provider could answer. ${failures.join("; ")}`
      : "No AI provider is configured. Add a key to your environment, or carry on entering products by hand.",
  );
}

type LogInput = {
  provider: string;
  model: string;
  feature: string;
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  actorId: string | null;
};

async function log(input: LogInput): Promise<void> {
  try {
    await prisma.aiUsageLog.create({ data: input });
  } catch (error) {
    // A logging failure must never be the reason a draft is lost.
    console.error("[trust-mart] could not record AI usage", error);
  }
}

/** How many calls have been made this calendar month, against the budget. */
export async function monthlyUsage(): Promise<{ used: number; budget: number; remaining: number }> {
  const settings = await getSettingGroup("ai");
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const used = await prisma.aiUsageLog.count({ where: { createdAt: { gte: monthStart }, success: true } });
  return {
    used,
    budget: settings.monthlyRequestBudget,
    remaining: Math.max(0, settings.monthlyRequestBudget - used),
  };
}
