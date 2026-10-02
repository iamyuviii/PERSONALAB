"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import useSWR from "swr";
import type { ResearchInput, ResearchResult } from "@/lib/types";
import { ResearchInputSchema, ResearchResultSchema } from "@/lib/schemas";
import { Landing } from "./landing";
import { SetupView } from "./setup-view";
import { PanelView } from "./panel-view";
import { SimulationsView } from "./simulations-view";
import { ReportView } from "./report-view";
import { AuditTrail, HoverScramble, ScrambleButton } from "./ui";

type View = "home" | "setup" | "panel" | "simulations" | "report";

const nav: { id: Exclude<View, "home">; label: string; num: string }[] = [
  { id: "setup", label: "Setup", num: "01" },
  { id: "panel", label: "Persona panel", num: "02" },
  { id: "simulations", label: "Simulations", num: "03" },
  { id: "report", label: "Research report", num: "04" },
];

const defaults: ResearchInput = {
  productName: "",
  description: "",
  targetAudience: "",
  landingCopy: "",
  pricing: "",
  competitors: "",
  questions: "",
  evidence: [],
  segmentWeights: {},
};

type SavedProject = { id: string; product: unknown; reports?: { data: unknown }[] };
const fetcher = async (url: string): Promise<SavedProject[]> => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load saved studies.");
  return data;
};

export function PersonaLabApp() {
  const [view, setView] = useState<View>("home");
  const [input, setInput] = useState<ResearchInput>(defaults);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState("P-01");
  const [filter, setFilter] = useState("All");
  const [auditOpen, setAuditOpen] = useState(false);

  const { data: projects, error: loadError, mutate } = useSWR("/api/projects", fetcher);
  const projectId = useRef<string | undefined>(undefined);
  const hydrated = useRef(false);
  const revision = useRef(0);
  const busy = useRef(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  // Revalidation must never overwrite edits or the result of a newer run.
  useEffect(() => {
    if (!projects || hydrated.current) return;
    hydrated.current = true;
    const project = projects[0];
    if (!project || revision.current > 0) return;
    projectId.current = project.id;
    const savedInput = ResearchInputSchema.safeParse(project.product);
    const savedResult = ResearchResultSchema.safeParse(project.reports?.[0]?.data);
    if (savedInput.success) {
      const weights = savedInput.data.segmentWeights;
      setInput({ ...savedInput.data, segmentWeights: weights && Object.keys(weights).length ? weights :
        Object.fromEntries(savedResult.success ? (savedResult.data.segments || []).map(s => [s.name, s.weight]) : []) });
    }
    if (savedResult.success) setResult(savedResult.data);
  }, [projects]);

  useEffect(() => { if (loadError) setError(loadError.message); }, [loadError]);

  const saveToDb = useCallback((nextInput: ResearchInput) => {
    const pending = saveQueue.current.catch(() => undefined).then(async () => {
      const id = projectId.current;
      const response = await fetch(id ? `/api/projects/${id}` : "/api/projects", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: nextInput }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save this study.");
      projectId.current = body.id;
      void mutate();
    });
    saveQueue.current = pending;
    return pending;
  }, [mutate]);

  const save = (nextInput: ResearchInput) => {
    void saveToDb(nextInput).catch(cause => { setError(cause.message); setView("setup"); });
  };

  const update = <K extends keyof ResearchInput>(
    key: K,
    value: ResearchInput[K]
  ) => {
    revision.current++;
    setInput((current) => ({ ...current, [key]: value }));
  };

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setRunning(true);
    try {
      const snapshot = ResearchInputSchema.parse(input);
      const runRevision = revision.current;
      // The research endpoint saves this snapshot itself, so a previous draft
      // save failure must not permanently prevent the user from retrying.
      await saveQueue.current.catch(() => undefined);
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...snapshot, projectId: projectId.current }),
      });
      const savedId = response.headers.get("X-Project-Id");
      if (savedId) projectId.current = savedId;
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Research run failed.");
      const nextResult = ResearchResultSchema.parse(body);
      hydrated.current = true;
      setResult(nextResult);
      if (runRevision === revision.current) setInput({ ...snapshot, segmentWeights: Object.fromEntries((nextResult.segments || []).map(s => [s.name, s.weight])) });
      setActive(nextResult.personas.find(p => !p.degraded)?.id || "P-01");
      setFilter("All");
      setView("panel");
      void mutate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Research run failed."
      );
    } finally {
      busy.current = false;
      setRunning(false);
    }
  };

  const reportInput = result?.inputSnapshot || input;

  const go = (next: View) => {
    if (next !== "setup" && next !== "home" && (!result || !result.personas.some(p => !p.degraded))) {
      setView("setup");
      setError("Run your research panel first to unlock this workspace.");
    } else setView(next);
  };

  if (view === "home")
    return <Landing onOpen={() => go("setup")} onReport={() => go("report")} />;

  return (
    <main className="app-shell">
      <aside>
        <button className="brand brand-button" onClick={() => go("home")}>
          <i />
          PERSONALAB <em>AI</em>
        </button>

        <div className="project-pill">
          <span>
            {input.productName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <b>{input.productName}</b>
            <small>
              {input.targetAudience.slice(0, 25)}
              {input.targetAudience.length > 25 ? "…" : ""}
            </small>
          </div>
        </div>

        <p className="nav-label">RESEARCH WORKSPACE</p>
        {nav.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? "side-nav selected" : "side-nav"}
            onClick={() => go(n.id)}
          >
            <span>{n.num}</span>
            <HoverScramble text={n.label} />
            {n.id === "report" && result && <i>●</i>}
          </button>
        ))}

        <div className="side-bottom">
          <p className="nav-label">RUN SETTINGS</p>
          <div className="run-setting">
            <span className="dot" />
            {result?.provider || "Ready to run"}
            <br />
            <small>
              {result?.model || "Groq · API key required"}
            </small>
          </div>
          {result?.auditTrail && result.auditTrail.length > 0 && (
            <button
              className="help"
              onClick={() => setAuditOpen(true)}
            >
              ⊞{" "}
              <HoverScramble
                text={`View audit trail (${result.auditTrail.length} stages)`}
              />
            </button>
          )}
          <button className="help" onClick={() => go("setup")}>
            <HoverScramble text="Edit research brief" />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-head">
          <div>
            <p className="micro">
              {(view === "setup" ? input : reportInput).productName.toUpperCase()} / {view.toUpperCase()}
            </p>
            <h2>
              {view === "setup"
                ? "Set up your research"
                : view === "panel"
                  ? "Your evidence-calibrated panel"
                  : view === "simulations"
                    ? "Persona simulation results"
                    : "Research report"}
            </h2>
          </div>
          <div className="head-actions">
            <ScrambleButton
              className="icon-button"
              onClick={() => go("setup")}
              text="Edit"
            />
            <button className="avatar">YR</button>
          </div>
        </header>

        {view === "setup" && (
          <SetupView
            input={input}
            update={update}
            running={running}
            error={error}
            onRun={run}
          />
        )}

        {view === "panel" && result && (
          <PanelView
            result={result}
            input={input}
            update={update}
            save={save}
            onNext={() => go("simulations")}
          />
        )}

        {view === "simulations" && result && (
          <SimulationsView
            people={result.personas.filter(p => !p.degraded)}
            active={active}
            setActive={setActive}
            filter={filter}
            setFilter={setFilter}
            onNext={() => go("report")}
            confidence={result.evidenceCoverage}
            disagreement={result.metrics?.disagreementScore}
            evidence={result.evidence || reportInput.evidence}
          />
        )}

        {view === "report" && result && (
          <ReportView
            result={result}
            input={reportInput}
            onRestart={() => go("setup")}
            onShowAudit={() => setAuditOpen(true)}
          />
        )}
      </section>

      {result?.auditTrail && (
        <AuditTrail
          trail={result.auditTrail}
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
        />
      )}
    </main>
  );
}
