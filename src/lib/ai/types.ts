/**
 * One shape for every AI provider.
 *
 * Gemini, OpenAI and Anthropic differ in envelope, not in substance: a system
 * instruction, a list of turns, a token cap, text back. Keeping that difference
 * behind this interface means the shop can start on a free tier and move to a
 * paid one by changing a setting, with no code touched.
 */

export type AiProviderKey = "gemini" | "openai" | "anthropic";

export type AiTurn = { role: "user" | "assistant"; content: string };

export type AiRequest = {
  system: string;
  messages: AiTurn[];
  maxTokens: number;
  /** Lower is more literal. Product copy wants a little room; facts do not. */
  temperature?: number;
  /** Which feature is spending the tokens, for the usage log. */
  feature: string;
};

export type AiResponse = {
  text: string;
  provider: AiProviderKey;
  model: string;
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type AiProvider = {
  key: AiProviderKey;
  label: string;
  /** Where to get a key, shown in the dashboard. */
  consoleUrl: string;
  /** True when a key is present in the environment. */
  isConfigured(): boolean;
  complete(request: AiRequest, model: string): Promise<AiResponse>;
};

/** Thrown when no provider can serve the request. Callers fall back to manual. */
export class AiUnavailableError extends Error {
  constructor(message = "No AI provider is configured.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}
