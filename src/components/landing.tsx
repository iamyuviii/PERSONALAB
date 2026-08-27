"use client";
import { Scramble, HoverScramble, ScrambleButton, BlockScrambleText } from "./ui";

export function Landing({
  onOpen,
  onReport,
}: {
  onOpen: () => void;
  onReport: () => void;
}) {
  return (
    <main className="landing">
      <header className="topbar">
        <div className="brand">
          <i />
          PERSONALAB <em>AI</em>
        </div>
        <nav>
          <a href="#method">
            <HoverScramble text="Method" />
          </a>
          <a href="#workflow">
            <HoverScramble text="Workflow" />
          </a>
          <a href="#integrity">
            <HoverScramble text="Integrity" />
          </a>
        </nav>
        <ScrambleButton
          text="Open workspace"
          className="button ghost"
          onClick={onOpen}
        >
          <b>↗</b>
        </ScrambleButton>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <span /> Evidence-calibrated synthetic research
        </div>
        <h1>
          Know what your
          <br />
          <BlockScrambleText text="market thinks" /> <i>before</i>
          <br />
          you build.
        </h1>
        <p>
          Pressure-test product decisions with an auditable panel of synthetic
          personas — directional insight, not false certainty.
        </p>
        <div className="actions">
          <ScrambleButton
            text="Start a research run"
            className="button lime"
            onClick={onOpen}
          >
            <b>→</b>
          </ScrambleButton>
          <ScrambleButton
            text="Open saved report"
            className="text-button"
            onClick={onReport}
          >
            <b>↗</b>
          </ScrambleButton>
        </div>
      </section>

      <section className="hero-console">
        <div className="console-top">
          <span>RESEARCH RUN</span>
          <span>EVIDENCE → PANEL → REPORT</span>
          <span className="status">● LIVE WORKFLOW</span>
        </div>
        <div className="console-grid">
          <div>
            <p className="micro">YOUR BRIEF</p>
            <strong>01</strong>
            <p>Product, audience, questions and evidence.</p>
          </div>
          <div className="command">
            <p className="micro">WHAT IT DOES</p>
            <h3>
              Turns source signals into
              <br />
              an inspectable <u>directional read.</u>
            </h3>
            <p>Every persona names the evidence that shaped it.</p>
            <ScrambleButton text="Build a panel" onClick={onOpen}>
              →
            </ScrambleButton>
          </div>
          <div className="dial">
            <div>AI</div>
            <p>Optional Groq generation</p>
            <span>LOCAL FALLBACK INCLUDED</span>
          </div>
        </div>
      </section>

      <LandingSections onOpen={onOpen} />
      <MarketingFooter onOpen={onOpen} />
    </main>
  );
}

function LandingSections({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="landing-sections">
      <section id="method" className="method-section">
        <p className="micro">THE METHOD / 01—03</p>
        <h2>
          Evidence first. <i>Assumptions visible.</i>
        </h2>
        <p className="section-lede">
          PersonaLab turns the inputs you already have into a clear, inspectable
          research direction—without pretending simulated results are real
          customers.
        </p>
        <div className="method-grid">
          <article>
            <b>01</b>
            <h3>Ground the panel</h3>
            <p>
              Paste reviews, notes, and support signals. Every persona shows
              what informed it.
            </p>
          </article>
          <article>
            <b>02</b>
            <h3>Pressure-test the idea</h3>
            <p>
              Compare clarity, trust, urgency, price sensitivity, and objections
              across a diverse panel.
            </p>
          </article>
          <article>
            <b>03</b>
            <h3>Choose what to test</h3>
            <p>
              Turn the disagreement into better interview questions and
              higher-confidence next steps.
            </p>
          </article>
        </div>
      </section>

      <section id="workflow" className="workflow-section">
        <div>
          <p className="micro">RESEARCH WORKFLOW</p>
          <h2>
            A tighter loop between
            <br />
            the brief and the <i>next decision.</i>
          </h2>
        </div>
        <ol>
          <li>
            <span>01</span> Add the product, audience, and evidence you trust.
          </li>
          <li>
            <span>02</span> Inspect personas and adjust segment assumptions.
          </li>
          <li>
            <span>03</span> Explore scored reactions, quotes, and objections.
          </li>
          <li>
            <span>04</span> Export a confidence-bounded report for the team.
          </li>
        </ol>
        <ScrambleButton
          text="Create a research run"
          className="button lime"
          onClick={onOpen}
        >
          <b>→</b>
        </ScrambleButton>
      </section>

      <section id="integrity" className="integrity-section">
        <span>◌</span>
        <div>
          <p className="micro">RESEARCH INTEGRITY</p>
          <h2>Useful direction, never false certainty.</h2>
          <p>
            Synthetic responses are a structured way to challenge your
            assumptions. They are not a replacement for talking to customers,
            measuring behavior, or making claims about your market.
          </p>
        </div>
      </section>
    </div>
  );
}

function MarketingFooter({ onOpen }: { onOpen: () => void }) {
  return (
    <footer className="marketing-footer">
      <div className="footer-topline">
        <span>PERSONALAB / SYNTHETIC RESEARCH SYSTEM</span>
        <span>↓ CONTINUE EXPLORING</span>
      </div>
      <div className="footer-main">
        <div className="footer-statement">
          <p className="micro">BUILD WITH BETTER QUESTIONS</p>
          <h2>
            Less certainty.
            <br />
            <i>Better direction.</i>
          </h2>
          <p>
            Start with the evidence you have. Leave with the assumptions worth
            testing.
          </p>
          <ScrambleButton
            text="Start a research run"
            className="footer-cta"
            onClick={onOpen}
          >
            ↗
          </ScrambleButton>
        </div>
        <div className="footer-orbit" aria-hidden="true">
          <span className="orbit-one" />
          <span className="orbit-two" />
          <span className="orbit-three" />
          <b>?</b>
          <em>
            CONFIDENCE
            <br />
            IS A QUESTION
          </em>
        </div>
        <div className="footer-nav">
          <div>
            <p className="micro">EXPLORE</p>
            <a href="#method">
              <HoverScramble text="Method" />
            </a>
            <a href="#workflow">
              <HoverScramble text="Workflow" />
            </a>
            <a href="#integrity">
              <HoverScramble text="Integrity" />
            </a>
          </div>
          <div>
            <p className="micro">WORKSPACE</p>
            <ScrambleButton
              text="New study"
              className="footer-link"
              onClick={onOpen}
            >
              →
            </ScrambleButton>
            <a href="mailto:hello@personalab.ai">
              <HoverScramble text="Contact" />
            </a>
          </div>
        </div>
      </div>
      <div className="footer-wordmark" aria-hidden="true">
        PERSONALAB
      </div>
      <div className="footer-base">
        <span>© 2026 PERSONALAB AI</span>
        <span>DIRECTION, NOT REPLACEMENT.</span>
        <span>01—04</span>
      </div>
    </footer>
  );
}
