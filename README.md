# PersonaLab AI

PersonaLab helps product teams form hypotheses to test with real customers. It generates a synthetic panel from a product brief and optional evidence, simulates each persona independently, and produces a saved research report. Scores describe simulated reactions, not predicted conversion rates.

## Run locally

Requires Node.js 22.12 or later.

1. Copy `.env.example` to `.env`.
2. Set `GROQ_API_KEY`. Live research requires a working Groq account and quota.
3. Run `npm install`.
4. Run `npm run db:setup` to generate the Prisma client and initialize SQLite.
5. Run `npm run dev`, then open the local address shown.

The existing layout, styling, and navigation are preserved.

## Deploy on Render free

Render free web services cannot persist a SQLite file. Use a hosted PostgreSQL database and deploy this version of the code.

1. Create an empty PostgreSQL database (for example, a Neon free project). Copy its direct/unpooled connection string and keep the provider's SSL parameters.
2. In Render's Environment settings, set `DATABASE_URL` to that `postgresql://...` connection string. Keep `GROQ_API_KEY` and set `EMBEDDING_PROVIDER=lexical`.
3. Set **Build Command** to `npm ci && npm run build`.
4. Set **Start Command** to `npm run db:deploy && npm run start -- --hostname 0.0.0.0 --port $PORT`.
5. Redeploy the updated repository. The start command applies the committed PostgreSQL migrations and checks a database read using the generated application client before serving requests.

Prisma uses its separate-process binary query engine to isolate it from Node's native TLS libraries. This addresses a possible runtime compatibility problem when migrations succeed but application queries fail with an OpenSSL error. Keep the provider's SSL settings enabled. Run `npm run db:check` for a read-only connection check; it prints runtime versions and a success/failure result without printing credentials or saved studies. The deployment check has a 45-second limit.

No persistent disk or pre-deploy command is needed. `db:generate` selects the Prisma schema from `DATABASE_URL`, and `db:setup` also supports PostgreSQL. Do not call `scripts/prepare-db.mjs` directly for a hosted database; that helper is exclusively for local SQLite.

Set `DATABASE_URL` before building, because Prisma generates a provider-specific client. Changing it from SQLite to PostgreSQL requires a fresh build. Use the same database provider at build and runtime.

This initializes a new PostgreSQL database; it does not transfer existing SQLite studies. Keep any existing SQLite database if you need its data. For future schema changes, update both schemas and add a PostgreSQL migration rather than using `db push` on the hosted database.

Render's own free PostgreSQL databases expire after 30 days: see [Render free-service limits](https://render.com/docs/free).

## Research workflow

1. Validate the product brief, unique evidence IDs, and optional segment weights.
2. Exclude held-out evidence and duplicate passages.
3. Extract market signals and propose customer segments.
4. Normalize segment weights and allocate 12 panel members, covering every active segment.
5. Retrieve relevant evidence and generate each profile independently.
6. Simulate each valid profile independently, including the supplied research questions.
7. Validate every score and response. Allow one format repair attempt; exclude failed profiles.
8. Calculate weighted scores, disagreement, and evidence coverage.
9. Group objections separately for assigned and open evaluations. Rank groups by represented panel weight.
10. Derive recommendations from the actual contributing responses.
11. Atomically save the report, personas, simulations, and audit trail.

A report is rejected if more than 20% of the panel count or weight fails, or an entire segment is unavailable. Provider errors produce explicit errors rather than fabricated results. Completed reports retain their original brief and evidence when the current study is edited.

## Retrieval

The default `EMBEDDING_PROVIDER=lexical` uses normalized word overlap and requires no model downloads. Citations retain their original evidence IDs.

Optional `EMBEDDING_PROVIDER=local` uses an already installed `Xenova/all-MiniLM-L6-v2` model. Set `LOCAL_EMBEDDING_MODEL_PATH` to its local model root if needed. Remote downloads are disabled. If the local model cannot load, research continues with lexical retrieval. The audit records the index mode.

Lexical retrieval can miss synonyms and paraphrases. Evidence coverage is the share of panel weight with retrieved evidence; it does not measure whether every generated claim is supported or whether the findings are correct.

## Persistence

SQLite locally, or PostgreSQL when configured, stores projects, evidence, run statuses, stage logs, current personas and simulations, immutable reports, and survey comparisons. The latest saved study and report are restored when the app loads. Changes to segment sliders affect the next run.

The application is intended for local, single-user use. Authentication and access control must be added before exposing private studies on a public server.

## Reliability and interpretation

- Requests have a six-minute deadline. Individual provider requests have a 45-second timeout.
- Transient provider failures get up to three transport attempts. Requests use Groq's token-reset headers to pace a single in-flight request per run.
- Responses must satisfy the schema; missing scores are never converted into neutral scores.
- Held-out evidence does not enter generation, retrieval, or coverage.
- Purchase intent and willingness to pay use ordinal 1–10 scales. They are neither currency nor conversion probabilities.
- Calibration compares the same 1–10 survey metric. A matching average alone does not establish predictive validity.
- Assigned objections are prompted research probes. They are reported separately from open responses.
- Evidence citations identify context supplied to a persona, not proof that its simulated objection was observed.
- No keyless synthetic-result fallback is provided. A missing key produces a setup error.

## Verification

```text
npm test
npm run typecheck
npm run lint
npm run build
```

Tests use a mock AI provider and disposable SQLite databases under `.test-build`. They never spend AI quota or overwrite the working database.

See [PROJECT_INDEX.md](PROJECT_INDEX.md) for the code map, repaired defects, and remaining limits.
