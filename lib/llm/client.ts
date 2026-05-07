import 'server-only';

import { GoogleGenAI, type Schema } from '@google/genai';
import { z, type ZodType } from 'zod';

/**
 * Provider-agnostic LLM gateway. Today only Gemini is wired (free tier);
 * the surface is designed so swapping in Anthropic / OpenAI later only adds
 * a branch in `callLLMJson` without changing call sites.
 *
 * Server-only by `import 'server-only'`: the LLM API key must NEVER reach
 * a client bundle, so no React component can import this file directly.
 */

type Provider = 'gemini' | 'anthropic' | 'openai';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;

interface CallOptions<T> {
  systemPrompt: string;
  userPrompt: string;
  /** Zod schema validated against the parsed JSON. Throws on failure. */
  zodSchema: ZodType<T>;
  /** Provider-native response schema (Gemini Schema, OpenAI json_schema, ...). */
  responseSchema: Schema;
  /** Defaults to LLM_MODEL env var, then a sensible fallback per provider. */
  model?: string;
  /** Per-attempt timeout in ms. Default 30s — Gemini Flash is usually <5s. */
  timeoutMs?: number;
}

function resolveProvider(): Provider {
  const raw = process.env.LLM_PROVIDER?.toLowerCase();
  if (raw === 'gemini' || raw === 'anthropic' || raw === 'openai') return raw;
  throw new Error(
    `LLM_PROVIDER must be one of: gemini | anthropic | openai (got "${raw ?? 'undefined'}")`,
  );
}

function requireApiKey(): string {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error('LLM_API_KEY is not set');
  return key;
}

/**
 * Generate JSON output from the LLM, validate it with Zod, and return it.
 * Retries up to MAX_ATTEMPTS with exponential backoff on transport / parse /
 * validation errors. Caller catches the final throw to fall back gracefully.
 */
export async function callLLMJson<T>(opts: CallOptions<T>): Promise<T> {
  const provider = resolveProvider();
  const model = opts.model ?? process.env.LLM_MODEL ?? DEFAULT_GEMINI_MODEL;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await callProvider({ provider, model, timeoutMs, ...opts });
      const parsed = JSON.parse(raw) as unknown;
      return opts.zodSchema.parse(parsed);
    } catch (err) {
      lastError = err;
      // No point retrying on missing-config errors; surface them immediately.
      if (err instanceof Error && /LLM_(API_KEY|PROVIDER)/.test(err.message)) throw err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(INITIAL_BACKOFF_MS * 2 ** (attempt - 1));
      }
    }
  }

  const message =
    lastError instanceof z.ZodError
      ? `LLM response failed schema validation after ${MAX_ATTEMPTS} attempts`
      : lastError instanceof Error
        ? lastError.message
        : 'unknown error';
  throw new Error(`LLM call failed: ${message}`);
}

interface InternalCall<T> extends CallOptions<T> {
  provider: Provider;
  model: string;
  timeoutMs: number;
}

async function callProvider<T>({
  provider,
  model,
  systemPrompt,
  userPrompt,
  responseSchema,
  timeoutMs,
}: InternalCall<T>): Promise<string> {
  if (provider !== 'gemini') {
    throw new Error(`Provider "${provider}" is not implemented yet`);
  }

  const ai = new GoogleGenAI({ apiKey: requireApiKey() });

  // AbortController is the only safe way to bound a fetch-backed SDK call.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema,
        // Slightly low temp keeps the JSON output deterministic enough to
        // survive the zod schema; we still want a tiny bit of warmth in the
        // explanation copy.
        temperature: 0.4,
        abortSignal: controller.signal,
      },
    });
    const text = result.text;
    if (!text) throw new Error('LLM returned empty response');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
