"use client";
import type { ResearchInput, ResearchResult, Persona } from "@/lib/types";
import { average } from "./ui";

export function ReportView({
  result,
  input,
  onRestart,
  onShowAudit,
}: {
  result: ResearchResult;
  input: ResearchInput;
  onRestart: () => void;
  onShowAudit: () => void;
}) {
  const allPeople = result.personas;
  const people = allPeople.filter(p => !p.degraded);
  const metrics = result.metrics;
  const clusters = result.objectionClusters || [];

  const degradedCount = metrics?.degradedCount ?? 0;
  const totalPersonaCount = metrics?.totalPersonaCount ?? allPeople.length;

  const intent = metrics?.purchaseIntent.mean ?? average(people, "purchase_intent");
  const clarity = metrics?.clarity.mean ?? average(people, "clarity_score");
  const trust = metrics?.trust.mean ?? average(people, "trust_score");
  const disagreement = metrics?.disagreementScore ?? computeDisagreement(people);
  const evidenceCoverage = result.evidenceCoverage;

  if (totalPersonaCount > 0 && degradedCount / totalPersonaCount > 0.2) {
    return (
      <div className="page report" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: "20vh" }}>
        <h2>Research Run Failed</h2>
        <p style={{ maxWidth: 400, margin: "1rem auto", color: "var(--text-muted)" }}>
          {degradedCount} of {totalPersonaCount} personas failed to generate. This usually indicates an API issue, rate limit, or format mismatch.
        </p>
        <button className="button lime" onClick={onRestart}>Try again</button>
      </div>
    );
  }

  const assignedRows = clusters.length > 0
    ? clusters.filter(c => c.mode === "assigned" || !c.mode)
    : result.signals.objections.map((label, i) => ({
      label,
      percentage: Math.round(
        (people.filter((p) => p.score.objection_category === label).length /
          (people.length || 1)) *
          100
      ),
      color: ["#d9ff5a", "#9b8cff", "#65d6ff", "#ff9a62"][i % 4],
    }));

  const openRows = clusters.length > 0
    ? clusters.filter(c => c.mode === "open")
    : [];

  const bars = people.map((p) => p.score.purchase_intent * 10);

  return (
    <div className="page report">
      {degradedCount > 0 && (
        <div className="banner warning" style={{ background: "#ffcc0022", color: "#ffcc00", padding: "0.75rem", borderRadius: "8px", marginBottom: "2rem", border: "1px solid #ffcc0044" }}>
          ⚠️ {degradedCount} of {totalPersonaCount} personas failed to generate and were excluded from these results.
        </div>
      )}
      <div className="report-top">
        <div>
          <p className="micro">
            REPORT / {new Date(result.generatedAt).toLocaleDateString()} ·{" "}
            {result.provider.toUpperCase()}
          </p>
          <h1>{input.productName}</h1>
          <p>
            A directional read of how the defined audience may respond to the
            offer.
          </p>
        </div>
        <div className="report-actions">
          <button className="button ghost" onClick={onShowAudit}>
            ⊞ Audit trail
          </button>
          <button className="button ghost" onClick={() => window.print()}>
            ↓ Export report
          </button>
        </div>
      </div>

      {/* Executive Signal */}
      <div className="finding">
        <span>01</span>
        <div>
          <p className="micro">EXECUTIVE SIGNAL</p>
          <h2>
            {Number(intent) >= 7 ? "The panel shows interest." : "The offer needs further validation."}
            <br />
            <i>{clusters[0]?.label || result.signals.objections[0] || "Value"} needs proof.</i>
          </h2>
        </div>
        <p>
          Purchase intent is {typeof intent === "number" ? intent.toFixed(1) : intent}/10 across this synthetic panel.
          Treat the findings as a testable direction, not a market forecast.
        </p>
      </div>

      {/* Metric Row */}
      <div className="metric-row">
        {[
          [
            "Purchase intent",
            typeof intent === "number" ? intent.toFixed(1) : intent,
            Number(intent) >= 7 ? "Promising" : "Needs validation",
          ],
          [
            "Message clarity",
            typeof clarity === "number" ? clarity.toFixed(1) : clarity,
            "Directional",
          ],
          [
            "Trust score",
            typeof trust === "number" ? trust.toFixed(1) : trust,
            "Evidence-led",
          ],
          [
            "Simulated variance",
            `${disagreement}%`,
            disagreement > 44 ? "Material — investigate" : "Limited",
          ],
        ].map(([label, value, note]) => (
          <article key={String(label)}>
            <p>{String(label)}</p>
            <strong>{String(value)}</strong>
            <span>{String(note)}</span>
          </article>
        ))}
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <article className="chart card">
          <header>
            <div>
              <p className="micro">PURCHASE INTENT</p>
              <h3>Distribution across panel</h3>
            </div>
            <span>{typeof intent === "number" ? intent.toFixed(1) : intent} / 10</span>
          </header>
          <div className="bar-chart">
            {bars.map((value, i) => (
              <div key={i}>
                <i style={{ height: `${value}%` }} />
                <span>{i + 1}</span>
              </div>
            ))}
          </div>
          <footer>
            <span>Persona</span>
            <span>Intent score</span>
          </footer>
        </article>

        <article className="chart card">
          <header>
            <div>
              <p className="micro">ASSIGNED OBJECTIONS</p>
              <h3>How the panel reacted to known barriers</h3>
            </div>
          </header>
          {assignedRows.map((item) => (
            <div className="objection-row" key={item.label}>
              <span>{item.label}</span>
              <div>
                <i
                  style={{
                    width: `${item.percentage}%`,
                    background: item.color,
                  }}
                />
              </div>
              <b>{item.percentage}%</b>
            </div>
          ))}
          {openRows.length > 0 && (
            <>
              <header style={{ marginTop: '2rem' }}>
                <div>
                  <p className="micro">DISCOVERED OBJECTIONS</p>
                  <h3>New barriers found by open personas</h3>
                </div>
              </header>
              {openRows.map((item) => (
                <div className="objection-row" key={item.label}>
                  <span>{item.label}</span>
                  <div>
                    <i
                      style={{
                        width: `${item.percentage}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                  <b>{item.percentage}%</b>
                </div>
              ))}
            </>
          )}
        </article>
      </div>

      {/* Segment Performance + Recommendations */}
      <div className="report-grid">
        <article className="card segment-performance">
          <p className="micro">SEGMENT PERFORMANCE</p>
          <h3>Where the signal is strongest</h3>
          {Array.from(new Set(people.map((p) => p.segment))).map((segment) => {
            const group = people.filter((p) => p.segment === segment);
            const value = average(group, "purchase_intent");
            return (
              <div key={segment}>
                <span>{segment}</span>
                <b>{typeof value === "number" ? value.toFixed(1) : value}/10</b>
                <i style={{ width: `${Number(value) * 10}%` }} />
              </div>
            );
          })}
        </article>

        <article className="card recommendations">
          <p className="micro">DERIVED RECOMMENDATIONS</p>
          <h3>What to change next</h3>
          <ol>
            {result.recommendations.map((item, index) => (
              <li key={`${item.title}:${index}`}>
                <b>{item.title}</b>
                <span>{item.detail}</span>
                {item.objectionCluster && (
                  <div className="rec-meta">
                    <span className="rec-cluster">{item.objectionCluster}</span>
                    <span className="rec-segment">{item.affectedSegment}</span>
                    <span className={`rec-impact impact-${item.expectedImpact}`}>
                      {item.expectedImpact} impact
                    </span>
                  </div>
                )}
                {item.evidenceIds && item.evidenceIds.length > 0 && (
                  <div className="rec-evidence">
                    {item.evidenceIds.map((id) => (
                      <b key={id}>{id}</b>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </article>
      </div>

      {/* Validity Caveat */}
      <div className="method-note">
        <span>◌</span>
        <p>
          <b>Evidence Coverage: {evidenceCoverage}/100 · Simulated variance: {disagreement}%.</b>{" "}
          This report reflects variance in evidence-grounded simulated personas, not
          observed customer behavior. High &ldquo;consistency&rdquo; can mean the
          model agrees with itself, not that reality agrees. Personas are stereotypes,
          and stereotypes are internally self-consistent. Validate the important
          assumptions with real conversations.
        </p>
        <button onClick={onRestart}>Start another study →</button>
      </div>
    </div>
  );
}

function computeDisagreement(people: Persona[]): number {
  if (people.length === 0) return 0;
  const values = people.map((p) => p.score.purchase_intent);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.min(100, Math.round(Math.sqrt(variance) / 4.5 * 100));
}
