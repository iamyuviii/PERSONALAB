/**
 * Evidence Retriever — vector-based retrieval for grounding personas.
 *
 * Rule: the model may only cite what it was actually given.
 * This module ensures grounding is traceable by construction.
 */

import { pipeline } from "@xenova/transformers";
import type { EvidenceSnippet } from "./types";

// ── Snippetization ──────────────────────────────────────────────────────────

/** Split multi-sentence evidence into individual snippets with stable IDs. */
export function snippetizeEvidence(
  rawEvidence: EvidenceSnippet[]
): EvidenceSnippet[] {
  const snippets: EvidenceSnippet[] = [];

  for (const item of rawEvidence) {
    if (item.heldOut) continue; // Do not snippetize held-out evidence
    
    // Split on sentence boundaries but keep meaningful chunks
    const sentences = item.text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentences.length <= 1) {
      // Already atomic — keep as-is
      snippets.push(item);
    } else {
      // Create sub-snippets with stable IDs
      sentences.forEach((sentence, idx) => {
        snippets.push({
          id: `${item.id}-${idx + 1}`,
          source: item.source,
          text: sentence,
          tags: item.tags,
          heldOut: false,
        });
      });
      // Also keep the original as a full-context snippet
      snippets.push(item);
    }
  }

  return snippets;
}

// ── Embeddings ──────────────────────────────────────────────────────────────

let pipelineInstance: any = null;

export async function getEmbeddingPipeline() {
  if (pipelineInstance) return pipelineInstance;
  
  pipelineInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return pipelineInstance;
}

async function getEmbedding(text: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER || "local";

  if (provider === "openai") {
    // Fallback to OpenAI if configured
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input: text, model: "text-embedding-3-small" })
    });
    if (!res.ok) throw new Error("OpenAI embedding failed");
    const data = await res.json();
    return data.data[0].embedding;
  }

  // Default: local transformers
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Inverted Index (Vector Store) ───────────────────────────────────────────

export type VectorIndex = Map<string, number[]>;

/** Build a dense vector index from snippets. */
export async function buildIndex(snippets: EvidenceSnippet[]): Promise<VectorIndex> {
  const index: VectorIndex = new Map();

  for (const snippet of snippets) {
    if (snippet.embedding && Array.isArray(snippet.embedding)) {
      index.set(snippet.id, snippet.embedding as number[]);
    } else {
      const textToEmbed = `${snippet.tags.join(" ")} ${snippet.source} ${snippet.text}`;
      const vector = await getEmbedding(textToEmbed);
      snippet.embedding = vector; // Cache it on the snippet
      index.set(snippet.id, vector);
    }
  }

  return index;
}

// ── Retrieval ───────────────────────────────────────────────────────────────

export interface RetrievalResult {
  snippet: EvidenceSnippet;
  relevanceScore: number;
}

/**
 * Retrieve top-k evidence snippets matching a query using cosine similarity.
 */
export async function retrieve(
  query: string,
  snippets: EvidenceSnippet[],
  index: VectorIndex,
  topK: number = 5
): Promise<RetrievalResult[]> {
  if (snippets.length === 0) return [];
  
  const queryVector = await getEmbedding(query);
  const scores = new Map<string, number>();

  for (const snippet of snippets) {
    const snippetVector = index.get(snippet.id);
    if (!snippetVector) continue;
    const similarity = cosineSimilarity(queryVector, snippetVector);
    scores.set(snippet.id, similarity);
  }

  const snippetMap = new Map(snippets.map((s) => [s.id, s]));

  return Array.from(scores.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, topK)
    .map(([id, relevanceScore]) => ({
      snippet: snippetMap.get(id)!,
      relevanceScore,
    }))
    .filter((r) => r.snippet !== undefined && r.relevanceScore > 0.3); // filter low confidence
}

/**
 * Retrieve evidence for a specific segment/persona context.
 */
export async function retrieveForContext(
  context: { segment: string; pain?: string; barrier?: string },
  snippets: EvidenceSnippet[],
  index: VectorIndex,
  topK: number = 4
): Promise<RetrievalResult[]> {
  const query = [context.segment, context.pain, context.barrier]
    .filter(Boolean)
    .join(" ");
  return retrieve(query, snippets, index, topK);
}
