/**
 * Thin client for any OpenAI-compatible chat-completions endpoint.
 * When no API key is configured the whole app still works — every AI feature
 * has a deterministic, local algorithm behind it (see analyze.ts / seo.ts).
 */
import { env, llmEnabled } from "../env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatJson<T>(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<T | null> {
  if (!llmEnabled) return null;
  try {
    const res = await fetch(`${env.llmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.llmApiKey}`,
      },
      body: JSON.stringify({
        model: env.llmModel,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1200,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export { llmEnabled };
