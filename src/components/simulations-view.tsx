"use client";
import type { Persona, EvidenceSnippet } from "@/lib/types";
import { initials, EvidenceCitation } from "./ui";

export function SimulationsView({
  people,
  active,
  setActive,
  filter,
  setFilter,
  onNext,
  confidence,
  disagreement,
  evidence,
}: {
  people: Persona[];
  active: string;
  setActive: (id: string) => void;
  filter: string;
  setFilter: (filter: string) => void;
  onNext: () => void;
  confidence: number;
  disagreement?: number;
  evidence?: EvidenceSnippet[];
}) {
  const objections = [
    "All",
    ...Array.from(new Set(people.map((p) => p.score.objection_category))),
  ];
  const shown =
    filter === "All"
      ? people
      : people.filter((p) => p.score.objection_category === filter);
  const selected =
    people.find((p) => p.id === active) || shown[0] || people[0];

  return (
    <div className="page simulations">
      <div className="signal-strip">
        <span>{people.length} independent simulations complete</span>
        <span>
          ▣ {confidence}% evidence confidence
        </span>
        {disagreement !== undefined && (
          <span className="variance-pill">
            ◎ {disagreement}% simulated variance
          </span>
        )}
        <span>↗ Zod-validated scores</span>
        <button onClick={onNext}>View report →</button>
      </div>

      <div className="simulation-layout">
        <div className="result-table">
          <header>
            <div>
              <h3>Panel responses</h3>
              <p>Each reaction was simulated independently — no anchoring.</p>
            </div>
            <select
              className="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {objections.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </header>

          {shown.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={active === p.id ? "response active" : "response"}
            >
              <div className="mini-avatar">{initials(p.name)}</div>
              <div className="response-name">
                <b>{p.name}</b>
                <span>{p.segment}</span>
              </div>
              <span className="score-value">
                {p.score.purchase_intent}
                <small>/10</small>
              </span>
              <span className="objection">{p.score.objection_category}</span>
              <span className="try">
                {p.score.likely_to_try ? "Likely to try" : "Unlikely"}
              </span>
            </button>
          ))}
        </div>

        <Interview person={selected} evidence={evidence} />
      </div>
    </div>
  );
}

function Interview({
  person,
  evidence,
}: {
  person: Persona;
  evidence?: EvidenceSnippet[];
}) {
  return (
    <article className="interview">
      <header>
        <div className="initials large">{initials(person.name)}</div>
        <div>
          <p className="micro">PERSONA INTERVIEW / {person.id}</p>
          <h3>{person.name}</h3>
          <span>
            {person.role} · {person.segment}
          </span>
        </div>
      </header>

      <div className="quote">{person.score.quote}</div>

      {person.score.interview_text && (
        <div className="interview-text">
          <p className="micro">FULL SIMULATED INTERVIEW</p>
          <p>{person.score.interview_text}</p>
        </div>
      )}

      <div className="answers">
        <div>
          <span>Do they understand it?</span>
          <b>
            {person.score.clarity_score >= 8
              ? "Immediately — the outcome is clear."
              : person.score.clarity_score >= 6
                ? "Somewhat — needs clearer framing."
                : "Not clearly — significant messaging work needed."}
          </b>
        </div>
        <div>
          <span>Biggest objection</span>
          <b>{person.score.objection_category}</b>
        </div>
        <div>
          <span>Conversion trigger</span>
          <b>{person.score.conversion_trigger || person.score.recommendation}</b>
        </div>
        <div>
          <span>Current workaround</span>
          <b>{person.workaround}</b>
        </div>
      </div>

      <div className="score-grid">
        {(
          [
            ["Clarity", person.score.clarity_score],
            ["Intent", person.score.purchase_intent],
            ["Trust", person.score.trust_score],
            ["Urgency", person.score.urgency_score],
            ["WTP", person.score.willingness_to_pay],
          ] as const
        ).map(([name, value]) => (
          <div key={name}>
            <span>{name}</span>
            <b>
              {value}
              <small>/10</small>
            </b>
            <i style={{ width: `${Number(value) * 10}%` }} />
          </div>
        ))}
      </div>

      <footer>
        <EvidenceCitation
          evidenceIds={person.retrievedEvidenceIds}
          evidence={evidence}
          groundingType={person.groundingType}
        />
      </footer>
    </article>
  );
}
