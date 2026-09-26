# Pravaah (name not final — config/app.ts)

Event crowd platform for big events. Three parts: ORGANISER sets up the event and approves plans;
SYSTEM simulates the evening, finds crowd problems, suggests fixes, computes all numbers; VISITOR
sees only the plan the head approved and published. Read docs/SPEC.md for the full data flow.

Engine first, golden test green (`npm test`), then UI.

## Rules

- Text: labels 1-4 words. One short sentence only behind a "Why?" tap. Max 3 numbers on screen at
  once. One main action per screen. No paragraphs, no jargon, no intro text.
- No hardcoded venue, gate, hotel or number in code or UI text. All data comes from Supabase. Only
  fixtures are the labeled sample files in contract/samples/.
- Every assumed number is labeled "assumption" in the UI.
- Trust levels: unverified capacity is reduced in the simulation. Only documented or observed data
  gets full credit. The discount lives in exactly one place: config/trust.ts.
- LLM = Groq gpt-oss-120b. Use it only for: reading messy files, turning typed text into
  structured actions, drafting event setup, writing short visitor text and translations, one-line
  "Why?". Always return JSON validated by zod. If invalid, retry once, then use a plain template.
- LLM never produces any number, density, cost or probability, and never approves anything. The
  engine computes numbers. The head approves.
- engine/ never imports from app/, components/ or browser APIs. It is copied verbatim from the old
  project and is never edited — if the engine seems wrong, fix the caller, not the engine.
- Each teammate works in their own folder and git branch. Only the contract owner edits contract/.
