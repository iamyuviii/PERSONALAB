"use client";
import type { ResearchInput } from "@/lib/types";
import { ScrambleButton } from "./ui";

export function SetupView({
  input,
  update,
  running,
  error,
  onRun,
}: {
  input: ResearchInput;
  update: <K extends keyof ResearchInput>(key: K, value: ResearchInput[K]) => void;
  running: boolean;
  error: string;
  onRun: () => void;
}) {
  const addEvidence = () =>
    update("evidence", [
      ...input.evidence,
      { id: `E-${String(Date.now()).slice(-5)}`, source: "Interview", text: "", tags: [], heldOut: false },
    ]);

  const changeEvidence = (index: number, field: "source" | "text", value: string) =>
    update(
      "evidence",
      input.evidence.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );

  const removeEvidence = (index: number) =>
    update(
      "evidence",
      input.evidence.filter((_, i) => i !== index)
    );

  return (
    <div className="page setup">
      <div className="notice">
        <b>◌</b>
        <span>
          <strong>Directional early-stage research.</strong> Outputs are synthetic
          and evidence-calibrated. Use them to form hypotheses to validate with
          real people.
        </span>
      </div>

      {error && <p className="error-banner">{error}</p>}

      <div className="form-grid">
        <Field
          label="Product name"
          value={input.productName}
          onChange={(v) => update("productName", v)}
        />
        <Field
          label="Pricing"
          value={input.pricing}
          onChange={(v) => update("pricing", v)}
        />
        <Field
          label="What are you building?"
          wide
          textarea
          value={input.description}
          onChange={(v) => update("description", v)}
        />
        <Field
          label="Target audience"
          wide
          value={input.targetAudience}
          onChange={(v) => update("targetAudience", v)}
        />
        <Field
          label="Landing page copy"
          wide
          textarea
          value={input.landingCopy || ""}
          onChange={(v) => update("landingCopy", v)}
        />
        <Field
          label="Competitors"
          wide
          value={input.competitors}
          onChange={(v) => update("competitors", v)}
        />
        <Field
          label="Research questions"
          wide
          textarea
          value={input.questions}
          onChange={(v) => update("questions", v)}
        />
      </div>

      <div className="evidence-title">
        <div>
          <p className="micro">OPTIONAL EVIDENCE</p>
          <h3>What are real people already saying?</h3>
        </div>
        <button className="text-button" onClick={addEvidence}>
          + Add source
        </button>
      </div>

      <div className="evidence-grid editable-evidence">
        {input.evidence.map((item, i) => (
          <article key={item.id} className="evidence-card">
            <div>
              <input
                aria-label="Evidence source"
                value={item.source}
                onChange={(e) => changeEvidence(i, "source", e.target.value)}
              />
              <button
                aria-label="Remove evidence"
                className="remove"
                onClick={() => removeEvidence(i)}
              >
                ×
              </button>
            </div>
            <textarea
              aria-label="Evidence text"
              placeholder="Paste a review, interview note, or customer quote…"
              value={item.text}
              onChange={(e) => changeEvidence(i, "text", e.target.value)}
            />
            <footer>
              <small>{item.id}</small>
            </footer>
          </article>
        ))}
      </div>

      <div className="run-bar">
        <div>
          <span className="dot" />{" "}
          <b>Research engine</b>
          <small>· Uses Groq when configured; otherwise runs locally</small>
        </div>
        <ScrambleButton
          className="button lime"
          disabled={running}
          onClick={onRun}
          text={running ? "Building panel..." : "Generate research panel ->"}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  wide,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  textarea?: boolean;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      {label}
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
