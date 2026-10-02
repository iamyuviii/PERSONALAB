import type { EvidenceSnippet } from "./types";

/** Preserve source IDs so every citation resolves after persistence and reload. */
export function snippetizeEvidence(evidence: EvidenceSnippet[]): EvidenceSnippet[] {
  const seen = new Set<string>();
  return evidence.filter(item => {
    const key = item.text.trim().toLowerCase().replace(/\s+/g, " ");
    if (item.heldOut || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(item => ({ ...item, tags: [...item.tags], embedding: undefined }));
}
const stopWords = new Set("a an and are as at be been but by can could do for from had has have i if in is it its may me my of on or our should that the their them there these they this to was we were will with would you your".split(" "));
export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(word => word.length > 2 && !stopWords.has(word));
}
export function lexicalSimilarity(a: string, b: string): number {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (!left.size || !right.size) return 0;
  return [...left].filter(word => right.has(word)).length / Math.sqrt(left.size * right.size);
}
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length || [...a, ...b].some(n => !Number.isFinite(n))) return 0;
  const dot = a.reduce((sum, value, i) => sum + value * b[i], 0);
  const norm = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0) * b.reduce((sum, value) => sum + value * value, 0));
  return norm ? Math.max(-1, Math.min(1, dot / norm)) : 0;
}
type Embedder = (text: string) => Promise<number[]>;
let localEmbedder: Promise<Embedder> | undefined;
async function createLocalEmbedder(): Promise<Embedder> {
  // Lazy and optional: normal research never needs native libraries or model downloads.
  const { pipeline, env } = await import("@xenova/transformers");
  env.allowRemoteModels = false;
  if (process.env.LOCAL_EMBEDDING_MODEL_PATH) env.localModelPath = process.env.LOCAL_EMBEDDING_MODEL_PATH;
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return async text => {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  };
}
async function embedderForRun(): Promise<Embedder | undefined> {
  if (process.env.EMBEDDING_PROVIDER !== "local") return undefined;
  localEmbedder ??= createLocalEmbedder();
  try { return await localEmbedder; } catch { return undefined; }
}
export interface VectorIndex {
  mode: "local" | "lexical";
  vectors: Map<string, number[]>;
  embed?: Embedder;
}
export async function buildIndex(snippets: EvidenceSnippet[]): Promise<VectorIndex> {
  const embed = snippets.length ? await embedderForRun() : undefined;
  const vectors = new Map<string, number[]>();
  if (embed) {
    try {
      for (const snippet of snippets) vectors.set(snippet.id, await embed(`${snippet.tags.join(" ")} ${snippet.text}`));
      return { mode: "local", vectors, embed };
    } catch { /* Fall back consistently for the whole index. */ }
  }
  return { mode: "lexical", vectors: new Map() };
}
export interface RetrievalResult { snippet: EvidenceSnippet; relevanceScore: number }
export async function retrieve(query: string, snippets: EvidenceSnippet[], index: VectorIndex, topK = 5): Promise<RetrievalResult[]> {
  if (!snippets.length || topK <= 0) return [];
  let queryVector: number[] | undefined;
  try { queryVector = await index.embed?.(query); } catch { /* Lexical fallback for this query. */ }
  return snippets.filter(s => !s.heldOut).map(snippet => ({
    snippet,
    relevanceScore: queryVector ? cosineSimilarity(queryVector, index.vectors.get(snippet.id) || []) : lexicalSimilarity(query, `${snippet.tags.join(" ")} ${snippet.text}`),
  })).filter(item => item.relevanceScore >= (queryVector ? 0.3 : 0.08))
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.snippet.id.localeCompare(b.snippet.id)).slice(0, topK);
}
export function retrieveForContext(context: { segment: string; pain?: string; barrier?: string }, snippets: EvidenceSnippet[], index: VectorIndex, topK = 4) {
  return retrieve([context.segment, context.pain, context.barrier].filter(Boolean).join(" "), snippets, index, topK);
}
