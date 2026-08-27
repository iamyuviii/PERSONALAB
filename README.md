# PersonaLab AI

**Directional synthetic research for early product decisions.** Findings are simulated, evidence-calibrated, and confidence-bounded — never presented as ground truth.

PersonaLab builds an auditable panel of synthetic personas from the evidence you already have, simulates independent product reactions, and produces a confidence-bounded research report with derived recommendations.

## Run locally

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Run `npm run dev`.

The seeded StudySprint AI brief works without keys or external services. Replace it with any product brief, add evidence, and run a complete research panel. Projects and their latest report are saved in the browser.

### Optional Groq model

Add `GROQ_API_KEY` to `.env` to run the pipeline against a real model. No key is required — PersonaLab falls back to a deterministic local engine so the entire workflow always works. The API key remains server-side.

When the Groq provider is active, every pipeline stage runs end-to-end through the same Zod-validated pipeline: market signals, segment distribution, retrieval-grounded persona generation, **independent per-persona reactions** (no batching), score extraction, aggregation, objection clustering, and derived recommendations.

## Architecture

```
Evidence (snippetized + indexed)
  → market signal extraction
  → segment distribution
  → personas            (retrieval-grounded, independent)
  → persona reactions   (INDEPENDENT calls, one per persona)
  → structured score extraction
  → aggregation / objection clustering
  → recommendations (derived) + confidence assessment
```

Every stage persists an audit record: input snapshot, validated JSON output, source evidence IDs, provider metadata, temperature, and timestamp.

### Files

- `src/lib/schemas.ts` — Zod contracts for every pipeline stage, audit records, and the full result.
- `src/lib/types.ts` — TypeScript types inferred from Zod schemas (single source of truth).
- `src/lib/research-engine.ts` — Staged pipeline orchestrator. 7 auditable stages.
- `src/lib/providers.ts` — Provider-agnostic adapter: `MockResearchProvider` (default) and `GroqResearchProvider` (live).
- `src/lib/evidence-retriever.ts` — Keyword/tag-based retrieval. Ensures grounding is traceable by construction.
- `src/lib/demo-data.ts` — StudySprint seed data: 10 evidence snippets, 12 personas, pre-computed clusters and recommendations.
- `src/app/api/research/route.ts` — API route that runs the full pipeline.
- `src/components/persona-lab-app.tsx` — Main orchestrator importing from decomposed components.
- `src/components/ui.tsx` — Shared components: scramble effects, confidence badge, evidence citation, audit trail drawer.
- `src/components/landing.tsx` — Landing page.
- `src/components/setup-view.tsx` — Research brief form and evidence management.
- `src/components/panel-view.tsx` — Persona panel with grounding badges and segment editor.
- `src/components/simulations-view.tsx` — Results table + interview drawer.
- `src/components/report-view.tsx` — Report with derived recommendations and charts.
- `prisma/schema.prisma` — SQLite schema (ready for database-backed audit trail).

## Validity caveat — as a feature

PersonaLab does not claim to replace customer research. This is by design and prominently displayed in the UI.

**What the simulated variance score means:**
- It is computed from the variance across **independently-run** persona reactions.
- High "consistency" can mean the model agrees with itself, not that reality agrees.
- Personas are stereotypes, and stereotypes are internally self-consistent.
- High disagreement **lowers confidence and becomes a finding**, never a hidden error.

**What retrieval-based grounding means:**
- Each persona shows the evidence IDs that were **actually retrieved and injected** into its prompt.
- "Grounded in 4 student comments" is true by construction — the model can only cite what it was given.
- Personas with no matching evidence are labeled **"hypothesis-based"** — never overclaimed.

**What derived recommendations mean:**
- The recommendation engine **computes** what to recommend from aggregated objection clusters.
- The LLM's only job is phrasing — the *what* is deterministic, the *wording* is generated.
- Each recommendation card shows its driving objection cluster, affected segment, and evidence chain.

Use PersonaLab to decide what to test next with real people — not to make claims about market share or conversion rates.

## Design tradeoffs

| Decision | Rationale |
|----------|-----------|
| Keyword retrieval over embeddings | No external embedding API dependency. Same grounding guarantees. Embedding-ready interface for later upgrade. |
| localStorage over Prisma for MVP | Zero-setup demo. Prisma schema is wired and ready for multi-user persistence. |
| Independent persona calls over batched | Prevents anchoring bias. Costs more API calls but produces real variance. |
| Mock provider as default | Deterministic, reproducible, free. Live provider works end-to-end when toggled. |
| Simulated variance label in UI | Names the limit before the interviewer does. Senior move, not naive. |

