"use client";
import type { ResearchInput, ResearchResult } from "@/lib/types";
import { initials, ConfidenceBadge, EvidenceCitation } from "./ui";

export function PanelView({
  result,
  input,
  update,
  save,
  onNext,
}: {
  result: ResearchResult;
  input: ResearchInput;
  update: <K extends keyof ResearchInput>(key: K, value: ResearchInput[K]) => void;
  save: (input: ResearchInput, result: ResearchResult | null) => void;
  onNext: () => void;
}) {
  const weights = input.segmentWeights && Object.keys(input.segmentWeights).length
    ? input.segmentWeights : Object.fromEntries((result.segments || []).map(s => [s.name, s.weight]));
  const entries = Object.entries(weights);

  const changeWeight = (name: string, value: number) => {
    const next = { ...weights, [name]: value };
    const nextInput = { ...input, segmentWeights: next };
    update("segmentWeights", next);
    save(nextInput, result);
  };

  const metrics = result.metrics;
  const disagreement = metrics?.disagreementScore;

  return (
    <div className="page">
      <div className="panel-intro">
        <div>
          <p className="micro">
            {result.personas.length} SYNTHETIC PERSONAS / {entries.length} SEGMENTS
          </p>
          <p>
            Personas are grounded in your evidence. Distribution changes are saved
            with this study and can be used on the next run.
          </p>
        </div>
        <ConfidenceBadge
          evidenceCoverage={result.evidenceCoverage}
          disagreement={disagreement}
          evidenceCount={(result.evidence || input.evidence).filter(e => !e.heldOut).length}
        />
      </div>

      <div className="segment-editor">
        {entries.map(([name, weight]) => (
          <label key={name}>
            <span>
              {name}
              <small>{weight}%</small>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={weight}
              onChange={(e) => changeWeight(name, +e.target.value)}
            />
          </label>
        ))}
        <div className="total">
          TOTAL{" "}
          <b>{entries.reduce((sum, [, value]) => sum + value, 0)}%</b>
        </div>
      </div>

      <div className="persona-head">
        <div>
          <h3>Sampled panel</h3>
          <p>
            Each profile includes an explicit evidence basis and structured reaction.
          </p>
        </div>
        <button className="button lime" onClick={onNext}>
          Review simulations →
        </button>
      </div>

      <div className="personas">
        {result.personas.map((p) => (
          <article key={p.id} className="persona">
            <header>
              <div className="initials">{initials(p.name)}</div>
              <div>
                <h3>{p.name}</h3>
                <p>{p.role}</p>
              </div>
              <span>{p.segment}</span>
            </header>
            <p className="bio">{p.bio}</p>
            <dl>
              <div>
                <dt>PAIN POINT</dt>
                <dd>{p.pain}</dd>
              </div>
              <div>
                <dt>BUYING STYLE</dt>
                <dd>{p.style}</dd>
              </div>
              <div>
                <dt>TRUST BARRIER</dt>
                <dd>{p.barrier}</dd>
              </div>
            </dl>
            <footer>
              <EvidenceCitation
                evidenceIds={p.retrievedEvidenceIds}
                evidence={result.evidence || result.inputSnapshot?.evidence || input.evidence}
                groundingType={p.groundingType}
              />
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
