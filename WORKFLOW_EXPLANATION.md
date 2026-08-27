# PersonaLab AI - Complete Workflow and Architecture Guide

This document explains everything happening in the PersonaLab AI application, how all the different components communicate, and what the purpose of each step in the synthetic research workflow is.

---

## 1. High-Level Concept: What Are We Doing?

**PersonaLab AI** is an application built for **synthetic product research**.
Instead of launching a product blindly or spending weeks finding human testers, you feed the application your product brief and any real-world "evidence" you already have (like customer quotes, interviews, or market feedback). The AI then simulates a "panel" of synthetic personas representing your target audience.

These personas interact with your product concept, generate structured feedback (purchase intent, clarity, objections), and then the application aggregates this into an **exportable research report**.

The goal is **directional insight** (figuring out what you should test next) rather than a replacement for real human testing.

---

## 2. Core Workflow: Step-by-Step

When you run the application and go through the research workflow, here is exactly what is happening under the hood:

### Phase 1: Setup & Intake
- **What happens:** You provide a comprehensive brief in the UI. This includes the product name, pricing, description, target audience, landing page copy, competitors, and specific research questions.
- **Evidence:** You can also add specific quotes or market signals ("evidence"). This evidence grounds the AI, making sure it doesn't just hallucinate standard responses but instead anchors the personas to real data you already have.
- **Where it lives:** Handled by the `Setup` component in `src/components/persona-lab-app.tsx`.

### Phase 2: Engine Execution (API)
- **What happens:** Once you click "Generate research panel", the app calls the backend API route at `src/app/api/research/route.ts`.
- **The Brains:** The backend decides how to process the request:
  - If you provided a `GROQ_API_KEY` in your `.env`, it will call out to Groq (running the Llama model) to generate highly dynamic, realistic personas and reactions.
  - If you didn't, it uses a **local deterministic fallback engine**. This ensures the demo and application *always work*, even offline or without keys.
- **Validation:** Both paths strictly enforce that the output matches a predefined structure using **Zod** (`src/lib/schemas.ts`). This ensures the AI returns clean JSON that the UI can parse perfectly (e.g., ensuring purchase intent is always a number from 1 to 10).

### Phase 3: Segment Editing & Panel Generation
- **What happens:** The AI returns a generated panel of synthetic personas, divided by market "segments".
- **Interaction:** The `Panel` UI lets you review these personas and adjust the "weight" (distribution) of each segment. If you know that "Enterprise buyers" make up 60% of your market, you adjust the slider here.
- **Transparency:** Every generated persona displays the explicit **evidence basis** it used to formulate its bio, pain points, and buying style.

### Phase 4: Persona Simulations & Interviews
- **What happens:** The AI simulates each persona's specific reaction to your product concept.
- **Metrics recorded:**
  - **Clarity Score:** Do they understand what the product does?
  - **Purchase Intent:** How likely are they to buy?
  - **Trust Score:** Do they trust the offer or the brand?
  - **Urgency Score:** Do they need this solved *right now*?
- **Feedback:** The UI (`Interview` component) displays these scores visually alongside their biggest objections, workarounds, and a direct quote summarizing their thoughts.

### Phase 5: Aggregation & Reporting
- **What happens:** The `Report` component synthesizes the individual persona data into a macro-level executive summary.
- **Key Metrics:**
  - **Averages:** It calculates the average purchase intent, message clarity, and trust.
  - **Variance/Disagreement:** It measures how much the personas disagreed. High variance means your messaging is polarizing or confusing to some segments.
  - **Clustering:** It automatically clusters the most common objections (e.g., "Price", "Trust", "Implementation time") into visual bar charts.
- **Recommendations:** It produces prioritized recommendations based on where the signal was strongest and what objections were most common.

---

## 3. Architecture & File Breakdown

Here is what the files in the repository actually do:

- **`src/components/persona-lab-app.tsx`**: The heart of the frontend. It contains all the UI components (`Landing`, `Setup`, `Panel`, `Interview`, `Report`) and manages the state of the active research run.
- **`src/app/globals.css`**: The design system. It contains all the styling for the application, enforcing a premium, high-contrast, modern UI (with the dark mode aesthetic, lime green accents, and specific responsive constraints).
- **`src/app/api/research/route.ts`**: The backend Next.js API route that acts as the bridge between the frontend request and the AI generation logic.
- **`src/lib/research-engine.ts`**: The core logic that talks to the Groq API (if configured) or executes the local deterministic generation path.
- **`src/lib/schemas.ts`**: The contract. It uses Zod to define exactly what a `Persona`, a `Score`, and a `ResearchResult` must look like.
- **`prisma/schema.prisma`**: The database schema. Although the current version saves state locally in the browser (for immediate MVP use), the Prisma schema is completely mapped out and ready to persist studies, evidence, and personas to a SQLite/Postgres database when multi-user support is needed.

## 4. Key Takeaways

1. **Direction, Not Replacement:** We are using AI to give us *directional evidence* to form hypotheses, not to replace real human customer interviews.
2. **Evidence-Grounded:** The system relies on real signals you feed it so it doesn't just invent generic feedback.
3. **Strict Formatting:** By utilizing Zod schemas, we force the AI to return data that fits perfectly into our charts and scoring modules.
4. **Resilient:** It works entirely locally if no API key is provided, guaranteeing that you always have a working demo.
