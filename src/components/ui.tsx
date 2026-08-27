"use client";
import { type ButtonHTMLAttributes, type CSSProperties, useEffect, useRef, useState } from "react";

// ── Text Scramble Effects ───────────────────────────────────────────────────

export function Scramble({ text }: { text: string }) {
  const [shown, setShown] = useState("·".repeat(text.length));
  useEffect(() => {
    let frame = 0;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%";
    const timer = window.setInterval(() => {
      frame++;
      setShown(
        text
          .split("")
          .map((character, index) =>
            index < frame
              ? character
              : character === " "
                ? " "
                : chars[Math.floor(Math.random() * chars.length)]
          )
          .join("")
      );
      if (frame > text.length) window.clearInterval(timer);
    }, 28);
    return () => window.clearInterval(timer);
  }, [text]);
  return (
    <span className="scramble" aria-label={text}>
      {shown}
    </span>
  );
}

export function BlockScrambleText({ text, className = "" }: { text: string; className?: string }) {
  const [shown, setShown] = useState(text);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const blocksRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsHighlighted(true);
            // Scramble Text
            let frame = 0;
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            const timer = window.setInterval(() => {
              frame += 0.7;
              setShown(
                text
                  .split("")
                  .map((character, index) =>
                    index < frame
                      ? character
                      : character === " "
                        ? " "
                        : chars[Math.floor(Math.random() * chars.length)]
                  )
                  .join("")
              );
              if (frame >= text.length) window.clearInterval(timer);
            }, 35);

            // Animate Blocks
            blocksRef.current.forEach((block) => {
              if (block) {
                block.classList.remove("animate");
                void block.offsetWidth; // trigger reflow
                block.style.animationDelay = Math.random() * 0.6 + "s";
                block.classList.add("animate");
              }
            });

            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span className={`text-wrapper-block ${className}`} ref={containerRef}>
      <span
        className="text relative z-10 inline-block px-1 transition-colors duration-500"
        style={{ color: isHighlighted ? "#11120f" : "inherit" }}
      >
        {shown}
      </span>
      <div className="overlay z-0">
        {Array.from({ length: 52 }).map((_, i) => (
          <div
            key={i}
            className="block"
            ref={(el) => {
              blocksRef.current[i] = el;
            }}
          />
        ))}
      </div>
    </span>
  );
}

export function useHoverScramble(text: string) {
  const [shown, setShown] = useState(text);
  const timer = useRef<number | null>(null);
  const start = () => {
    if (timer.current) window.clearInterval(timer.current);
    let frame = 0;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%";
    timer.current = window.setInterval(() => {
      frame++;
      setShown(
        text
          .split("")
          .map((character, index) =>
            index < frame
              ? character
              : character === " "
                ? " "
                : chars[Math.floor(Math.random() * chars.length)]
          )
          .join("")
      );
      if (frame > text.length) {
        if (timer.current) window.clearInterval(timer.current);
        timer.current = null;
        setShown(text);
      }
    }, 24);
  };
  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    []
  );
  useEffect(() => {
    setShown(text);
  }, [text]);
  return { shown, start };
}

export function HoverScramble({ text }: { text: string }) {
  const { shown, start } = useHoverScramble(text);
  return (
    <span
      className="hover-scramble"
      onMouseEnter={start}
      onFocus={start}
      style={{ "--scramble-chars": text.length } as CSSProperties}
      tabIndex={0}
    >
      {shown}
    </span>
  );
}

export function ScrambleButton({
  text,
  className = "",
  children,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { text: string }) {
  const { shown, start } = useHoverScramble(text);
  return (
    <button
      className={`scramble-button ${className}`}
      onMouseEnter={start}
      onFocus={start}
      style={{ ...style, "--scramble-chars": text.length } as CSSProperties}
      {...props}
    >
      <span className="hover-scramble">{shown}</span>
      {children}
    </button>
  );
}

// ── Utility Functions ───────────────────────────────────────────────────────

export const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("");

export const average = (
  items: { score: Record<string, unknown> }[],
  key: string
) =>
  items.length
    ? items.reduce((sum, p) => sum + Number(p.score[key as keyof typeof p.score]), 0) / items.length
    : 0;

// ── Confidence Badge ────────────────────────────────────────────────────────

export function ConfidenceBadge({
  confidence,
  disagreement,
  evidenceCount,
}: {
  confidence: number;
  disagreement?: number;
  evidenceCount?: number;
}) {
  return (
    <div className="confidence-badge">
      <div className="confidence-ring">
        <b>{confidence}</b>
      </div>
      <div className="confidence-info">
        <span>
          Evidence confidence
          <br />
          <small>
            {confidence >= 70 ? "Strong" : confidence >= 45 ? "Moderate" : "Limited"} ·{" "}
            {evidenceCount ?? "?"} source signals
          </small>
        </span>
        {disagreement !== undefined && (
          <span className="simulated-variance">
            Simulated variance: {disagreement}%
            <span className="variance-tooltip">
              Computed from independent persona runs. High consistency may mean the model agrees with itself, not that reality agrees.
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Evidence Citation ───────────────────────────────────────────────────────

export function EvidenceCitation({
  evidenceIds,
  evidence,
  groundingType,
}: {
  evidenceIds: string[];
  evidence?: { id: string; source: string; text: string }[];
  groundingType?: "retrieval" | "hypothesis";
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="evidence-citation">
      {groundingType && (
        <span className={`grounding-badge ${groundingType}`}>
          {groundingType === "retrieval" ? "RETRIEVAL-GROUNDED" : "HYPOTHESIS-BASED"}
        </span>
      )}
      <span className="citation-label">
        {groundingType === "retrieval"
          ? `Grounded in ${evidenceIds.length} source${evidenceIds.length !== 1 ? "s" : ""}`
          : "No matching evidence — hypothesis-based"}
      </span>
      <div className="citation-ids">
        {evidenceIds.map((id) => {
          const snippet = evidence?.find((e) => e.id === id);
          return (
            <button
              key={id}
              className={`citation-tag ${expanded === id ? "expanded" : ""}`}
              onClick={() => setExpanded(expanded === id ? null : id)}
              title={snippet?.text}
            >
              {id}
            </button>
          );
        })}
      </div>
      {expanded && evidence && (
        <div className="citation-popover">
          {(() => {
            const s = evidence.find((e) => e.id === expanded);
            if (!s) return null;
            return (
              <>
                <small>{s.source}</small>
                <p>{s.text}</p>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Audit Trail Drawer ──────────────────────────────────────────────────────

export function AuditTrail({
  trail,
  open,
  onClose,
}: {
  trail: {
    stage: string;
    provider: string;
    model: string;
    timestamp: string;
    durationMs?: number;
    sourceEvidenceIds: string[];
    temperature?: number;
  }[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="audit-overlay" onClick={onClose}>
      <aside className="audit-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <p className="micro">PIPELINE AUDIT TRAIL</p>
            <h3>Research run stages</h3>
          </div>
          <button className="icon-button" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="audit-stages">
          {trail.map((record, i) => (
            <article key={i} className="audit-stage">
              <div className="stage-index">{String(i + 1).padStart(2, "0")}</div>
              <div className="stage-body">
                <h4>{record.stage}</h4>
                <div className="stage-meta">
                  <span>
                    {record.provider} · {record.model}
                  </span>
                  {record.temperature !== undefined && (
                    <span>temp: {record.temperature.toFixed(2)}</span>
                  )}
                  {record.durationMs !== undefined && (
                    <span>{record.durationMs}ms</span>
                  )}
                </div>
                {record.sourceEvidenceIds.length > 0 && (
                  <div className="stage-evidence">
                    {record.sourceEvidenceIds.slice(0, 6).map((id) => (
                      <b key={id}>{id}</b>
                    ))}
                    {record.sourceEvidenceIds.length > 6 && (
                      <span>+{record.sourceEvidenceIds.length - 6} more</span>
                    )}
                  </div>
                )}
                <time>{new Date(record.timestamp).toLocaleTimeString()}</time>
              </div>
            </article>
          ))}
        </div>
        <footer className="audit-footer">
          <span>◌</span>
          <p>
            Each stage persists its input, validated output, source evidence, and provider metadata.
            This trail is the product&apos;s credibility layer.
          </p>
        </footer>
      </aside>
    </div>
  );
}
