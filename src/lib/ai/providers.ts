import "server-only";

import { AiUnavailableError, type AiProvider, type AiProviderKey, type AiRequest, type AiResponse } from "./types";

/**
 * The three providers, each behind the same interface.
 *
 * Written against the raw HTTP APIs rather than three SDKs: the SDKs are large,
 * they disagree about how to be configured, and all we need from each is one
 * POST. Keys are read from the environment at call time, never stored in the
 * database and never sent to the browser.
 */

const TIMEOUT_MS = 45_000;

function key(name: string): string {
  return process.env[name] ?? "";
}

async function post(url: string, init: RequestInit): Promise<{ status: number; body: unknown; text: string }> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new AiUnavailableError(`Could not reach the AI provider: ${(error as Error).message}`);
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body, text };
}

function dig(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) return current[Number(segment)];
    if (current && typeof current === "object") return (current as Record<string, unknown>)[segment];
    return undefined;
  }, value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function failed(label: string, status: number, text: string): never {
  // The provider's own message is worth surfacing — "quota exceeded" and
  // "model not found" need different responses from the person reading it.
  throw new AiUnavailableError(`${label} refused the request (HTTP ${status}): ${text.slice(0, 300)}`);
}

/* -------------------------------------------------------------------------- */

const gemini: AiProvider = {
  key: "gemini",
  label: "Google Gemini",
  consoleUrl: "https://aistudio.google.com/apikey",
  isConfigured: () => Boolean(key("GEMINI_API_KEY") || key("AI_GEMINI_API_KEY")),

  async complete(request: AiRequest, model: string): Promise<AiResponse> {
    const apiKey = key("GEMINI_API_KEY") || key("AI_GEMINI_API_KEY");
    if (!apiKey) throw new AiUnavailableError("Gemini has no API key configured.");

    const startedAt = Date.now();
    const { status, body, text } = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: request.messages.map((message) => ({
            // Gemini calls the assistant "model"; everything else says
            // "assistant". This is the whole difference.
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            maxOutputTokens: request.maxTokens,
            temperature: request.temperature ?? 0.4,
          },
        }),
      },
    );

    if (status >= 400) failed("Gemini", status, text);

    return {
      text: asText(dig(body, "candidates.0.content.parts.0.text")),
      provider: "gemini",
      model,
      promptTokens: asCount(dig(body, "usageMetadata.promptTokenCount")),
      outputTokens: asCount(dig(body, "usageMetadata.candidatesTokenCount")),
      latencyMs: Date.now() - startedAt,
    };
  },
};

const openai: AiProvider = {
  key: "openai",
  label: "OpenAI",
  consoleUrl: "https://platform.openai.com/api-keys",
  isConfigured: () => Boolean(key("OPENAI_API_KEY") || key("AI_OPENAI_API_KEY")),

  async complete(request: AiRequest, model: string): Promise<AiResponse> {
    const apiKey = key("OPENAI_API_KEY") || key("AI_OPENAI_API_KEY");
    if (!apiKey) throw new AiUnavailableError("OpenAI has no API key configured.");

    const startedAt = Date.now();
    const { status, body, text } = await post("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_completion_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.4,
        messages: [
          { role: "system", content: request.system },
          ...request.messages.map((message) => ({ role: message.role, content: message.content })),
        ],
      }),
    });

    if (status >= 400) failed("OpenAI", status, text);

    return {
      text: asText(dig(body, "choices.0.message.content")),
      provider: "openai",
      model,
      promptTokens: asCount(dig(body, "usage.prompt_tokens")),
      outputTokens: asCount(dig(body, "usage.completion_tokens")),
      latencyMs: Date.now() - startedAt,
    };
  },
};

const anthropic: AiProvider = {
  key: "anthropic",
  label: "Anthropic Claude",
  consoleUrl: "https://console.anthropic.com/settings/keys",
  isConfigured: () => Boolean(key("ANTHROPIC_API_KEY") || key("AI_ANTHROPIC_API_KEY") || key("AI_API_KEY")),

  async complete(request: AiRequest, model: string): Promise<AiResponse> {
    const apiKey = key("ANTHROPIC_API_KEY") || key("AI_ANTHROPIC_API_KEY") || key("AI_API_KEY");
    if (!apiKey) throw new AiUnavailableError("Anthropic has no API key configured.");

    const startedAt = Date.now();
    const { status, body, text } = await post("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.4,
        system: request.system,
        messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
      }),
    });

    if (status >= 400) failed("Anthropic", status, text);

    return {
      text: asText(dig(body, "content.0.text")),
      provider: "anthropic",
      model,
      promptTokens: asCount(dig(body, "usage.input_tokens")),
      outputTokens: asCount(dig(body, "usage.output_tokens")),
      latencyMs: Date.now() - startedAt,
    };
  },
};

export const AI_PROVIDERS: Record<AiProviderKey, AiProvider> = { gemini, openai, anthropic };

export const AI_PROVIDER_LIST = Object.values(AI_PROVIDERS);

export function getAiProvider(key: AiProviderKey): AiProvider {
  return AI_PROVIDERS[key];
}

/** True when at least one provider has a key, so the AI panels are worth showing. */
export function anyAiProviderConfigured(): boolean {
  return AI_PROVIDER_LIST.some((provider) => provider.isConfigured());
}
