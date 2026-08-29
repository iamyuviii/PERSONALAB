/**
 * Research Providers — adapter pattern so pipeline code never branches on provider.
 *
 * GroqResearchProvider: real model calls, same Zod-validated pipeline.
 */

export interface ProviderMetadata {
  provider: string;
  model: string;
  deterministic: boolean;
}

export interface CompletionOptions {
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
}

/**
 * Unified provider interface — pipeline constructs prompts and calls complete().
 * Provider handles transport only. Validation is the pipeline's job.
 */
export interface ResearchProvider {
  metadata: ProviderMetadata;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
}

// ── Groq Provider ───────────────────────────────────────────────────────────

/**
 * Real provider: calls Groq API with the constructed prompt.
 * Must run end-to-end through every pipeline stage with Zod validation.
 */
export class GroqResearchProvider implements ResearchProvider {
  metadata: ProviderMetadata;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "openai/gpt-oss-20b";
    this.metadata = {
      provider: "groq",
      model: this.model,
      deterministic: false,
    };
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const temperature = options?.temperature ?? 0.45;

    const body: Record<string, unknown> = {
      model: this.model,
      temperature,
      messages: [{ role: "user", content: prompt }],
      max_tokens: options?.maxTokens || 4096,
    };

    if (options?.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("GROQ API FULL ERROR:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
      });
      throw new Error(
        `Groq API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("GROQ EMPTY RESPONSE:", JSON.stringify(data, null, 2));
      throw new Error("Groq returned an empty response.");
    }

    return content;
  }
}

// ── Provider Factory ────────────────────────────────────────────────────────

export function getProvider(): ResearchProvider {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  
  console.log("INITIALIZING PROVIDER:", {
    hasKey: !!apiKey,
    keyLength: apiKey?.length,
    model: model
  });

  if (apiKey && apiKey.length > 10) {
    return new GroqResearchProvider(apiKey, model);
  }

  throw new Error("GROQ_API_KEY environment variable is required to run the pipeline.");
}
