# PersonaLab AI: System Architecture & Implementation Plan

*Note to AI: I am sharing the implementation plan of my current project, PersonaLab AI. Please review the architecture, tech stack, and workflow below, and provide suggestions for improvements, potential pitfalls, or new features.*

## Project Overview
**PersonaLab AI** is a synthetic product research tool. It takes a product brief and raw market evidence (quotes, feedback) and uses an LLM to simulate a panel of synthetic personas. These personas independently review the product and generate confidence-bounded research reports with derived recommendations. 

The goal is to provide directional insights for early product decisions, explicitly framed as hypotheses rather than ground truth.

## Tech Stack
- **Framework**: Next.js (React)
- **Language**: TypeScript
- **Styling**: Custom CSS (Premium dark mode aesthetic)
- **Validation**: Zod (Enforces strict structured outputs from the LLM)
- **AI Provider**: Groq (Llama models) with a local deterministic fallback for offline/keyless demos.
- **Database (Planned)**: Prisma with SQLite/Postgres for state persistence.

## Core Architecture & Workflow
The application follows a 5-phase auditable pipeline:

1. **Intake & Evidence (Setup)**
   - User inputs a product brief (name, description, target audience, pricing).
   - User inputs "evidence" (real-world market signals, quotes, research).
   
2. **Segment Distribution & Persona Generation**
   - The AI extracts market signals and creates customer segments.
   - Personas are generated using **retrieval-grounded** logic (they are only allowed to cite evidence explicitly injected into their context).

3. **Independent Simulations**
   - Each persona evaluates the product *independently* (no batching to avoid anchoring bias).
   - Generates specific metrics: Clarity Score, Purchase Intent, Trust Score, Urgency Score.

4. **Aggregation & Clustering**
   - The system aggregates scores to calculate variance. (High variance = polarizing product, which lowers confidence but provides a finding).
   - Objections are clustered automatically.

5. **Reporting (Output)**
   - Deterministic recommendation engine computes next steps based on clustered objections.
   - Generates a final visual report with confidence bounds and evidence citations.

## Key Design Tradeoffs
- **Keyword Retrieval over Embeddings**: No external embedding API dependency for the MVP, ensuring the app runs locally without extra setup.
- **Independent LLM Calls**: We run one call per persona rather than batching them. This costs more API calls but prevents the LLM from homogenizing responses.
- **Strict Zod Contracts**: Every pipeline stage forces the LLM to return data matching a Zod schema, ensuring the UI never breaks due to malformed JSON.

## Request for AI Suggestions
Based on the above architecture, please provide:
1. **Architecture Improvements**: Are there bottlenecks or better design patterns for this pipeline?
2. **Feature Expansion**: What additional features would make this synthetic research more valuable or trustworthy?
3. **Tech Stack Advice**: Are there better tools for state management, embedding, or prompt chaining that I should consider?
