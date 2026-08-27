"use client";
import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import type { ResearchInput, ResearchResult } from "@/lib/types";
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

export function PersonaLabApp() {
  const [view, setView] = useState<View>("home");
  const [input, setInput] = useState<ResearchInput>(defaults);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState("P-01");
  const [filter, setFilter] = useState("All");
  const [auditOpen, setAuditOpen] = useState(false);

  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data: projects, mutate } = useSWR("/api/projects", fetcher);
  
  const currentProject = projects?.[0];

  // Initialize input/result from the database once loaded
  useEffect(() => {
    if (currentProject) {
      if (currentProject.product && currentProject.evidence) {
        setInput({
          ...defaults,
          ...currentProject.product,
          evidence: currentProject.evidence,
        });
      }
      // Assuming result is saved in a run/report (MVP: we could load latest report if needed)
      // For now, if there's a result, it should be restored here if implemented.
    }
  }, [currentProject]);

  const saveToDb = useCallback(async (nextInput: ResearchInput, nextResult: ResearchResult | null) => {
    if (currentProject) {
      await fetch(`/api/projects/${currentProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextInput.productName, product: nextInput }),
      });
      mutate();
    } else {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextInput.productName, product: nextInput, evidence: nextInput.evidence }),
      });
      mutate();
    }
  }, [currentProject, mutate]);

  const save = (nextInput: ResearchInput, nextResult: ResearchResult | null) => {
    saveToDb(nextInput, nextResult);
  };

  const update = <K extends keyof ResearchInput>(
    key: K,
    value: ResearchInput[K]
  ) => setInput((current) => ({ ...current, [key]: value }));

  const run = async () => {
    setError("");
    setRunning(true);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Research run failed.");
      setResult(body);
      save(input, body);
      setActive(body.personas[0].id);
      setView("panel");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Research run failed."
      );
    } finally {
      setRunning(false);
    }
  };

  const go = (next: View) => {
    if (next !== "setup" && next !== "home" && !result) {
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
              {result?.model || "Groq optional · local fallback"}
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
              {input.productName.toUpperCase()} / {view.toUpperCase()}
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
            people={result.personas}
            active={active}
            setActive={setActive}
            filter={filter}
            setFilter={setFilter}
            onNext={() => go("report")}
            confidence={result.confidence}
            disagreement={result.metrics?.disagreementScore}
            evidence={input.evidence}
          />
        )}

        {view === "report" && result && (
          <ReportView
            result={result}
            input={input}
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
