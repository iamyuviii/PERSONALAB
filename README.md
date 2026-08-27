# PersonaLab AI

**Directional synthetic research for early product decisions.** Findings are simulated, evidence-calibrated, and confidence-bounded — never presented as ground truth.

PersonaLab builds an auditable panel of synthetic personas from the evidence you already have, simulates independent product reactions, and produces a confidence-bounded research report with derived recommendations.

## Run locally

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Set up the local SQLite database with `npx prisma db push`.
4. Run `npm run dev`.

Replace the seeded product brief with your own, add evidence, and run a complete research panel. Projects, pipeline runs, and the latest reports are saved persistently to a local SQLite database using Prisma.

### Groq Provider (Live Inference)

PersonaLab uses Groq for lightning-fast model inference. Add `GROQ_API_KEY` to your `.env` file to run the pipeline against a real model. 

When the Groq provider is active, every pipeline stage runs end-to-end through a Zod-validated pipeline: market signals, segment distribution, retrieval-grounded persona generation, **independent per-persona reactions** (no batching), score extraction, aggregation, dense vector objection clustering, and derived recommendations.

## Architecture

```
Evidence (snippetized + local embeddings indexed)
  → market signal extraction
  → segment distribution
  → personas            (retrieval-grounded, independent)
  → persona reactions   (INDEPENDENT calls, one per persona)
  → structured score extraction
  → aggregation / dense vector objection clustering (Xenova local embeddings)
  → recommendations (derived) + confidence assessment
```

Every stage persists an audit record: input snapshot, validated JSON output, source evidence IDs, provider metadata, temperature, and timestamp.

### Files

- `src/lib/schemas.ts` — Zod contracts for every pipeline stage, audit records, and the full result.
- `src/lib/types.ts` — TypeScript types inferred from Zod schemas (single source of truth).
- `src/lib/research-engine.ts` — Staged pipeline orchestrator with concurrency limiters. 7 auditable stages.
- `src/lib/calibration.ts` — Calibration harness for hold-out backtesting against ground truth.
- `src/lib/providers.ts` — Provider adapter configured for Groq with specific model aliases.
- `src/lib/evidence-retriever.ts` — Runs local `@xenova/transformers` for semantic dense vector retrieval and clustering.
- `src/app/api/projects/route.ts` & `[id]/route.ts` — Next.js 15 App Router endpoints for Prisma persistence.
- `prisma/schema.prisma` — SQLite schema powering multi-tenant storage for projects, logs, and reports.
- `src/components/persona-lab-app.tsx` — Main SWR-backed orchestrator importing from decomposed components.

## Validity caveat — as a feature

PersonaLab does not claim to replace customer research. This is by design and prominently displayed in the UI.

**What the simulated variance score means:**
- It is computed from the variance across **independently-run** persona reactions.
- High "consistency" can mean the model agrees with itself, not that reality agrees.
- Personas are stereotypes, and stereotypes are internally self-consistent.
- High disagreement **lowers confidence and becomes a finding**, never a hidden error.

**What retrieval-based grounding means:**
- Each persona shows the evidence IDs that were **actually retrieved and injected** into its prompt using dense vector similarity.
- "Grounded in 4 student comments" is true by construction — the model can only cite what it was given.
- Personas with no matching evidence are labeled **"hypothesis-based"** — never overclaimed.

**What derived recommendations mean:**
- The recommendation engine **computes** what to recommend from aggregated objection clusters. Objections are dynamically grouped via cosine similarity using local embeddings.
- The LLM's only job is phrasing — the *what* is deterministic, the *wording* is generated.
- Each recommendation card shows its driving objection cluster, affected segment, and evidence chain.

Use PersonaLab to decide what to test next with real people — not to make claims about market share or conversion rates.

## Core Features

| Feature | Implementation |
|----------|-----------|
| **Local Embeddings** | `@xenova/transformers` runs entirely locally for offline semantic search and vector objection clustering. No API keys needed for vectors. |
| **Durable Persistence** | Fully backed by Prisma and SQLite. State is reliably fetched via `swr` to keep the UI snappy and in sync with the DB. |
| **Independent Simulation** | Each persona reacts to the product independently inside a `p-limit` concurrency pool to maximize speed while generating true variance without anchoring bias. |
| **Calibration Harness** | Built-in hold-out backtesting logic (`calibration.ts`) to grade synthetic output against held-out real-world user evidence. |
| **Zod-Enforced Guardrails** | Every stage strictly validates inputs/outputs with fallback mechanisms seeded to maintain variance in edge cases. |
