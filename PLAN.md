# Buddy — RAITE 2026 Action Plan

Plan to address the audit feedback. Ordered by priority: compliance risks first, then pitch-defining features, then polish and deliverables.

---

## Phase 1 — Compliance (eligibility risks, do first)

### 1.1 Swap AI provider off Groq
Groq is not on the allowed AI list. Replace everywhere.

- [ ] Inventory every call site using Groq / Llama 3.3 via Groq
  - Next.js API routes (grep for `groq`, `GROQ_API_KEY`, `llama`)
  - Python backend `groq-sdk` call in literature gap analysis
- [ ] Pick replacement provider: **Claude** (preferred — allowed, strong reasoning), Gemini, or OpenAI
- [ ] Swap model string in each Vercel AI SDK call (one-line change per route)
- [ ] Update `.env.example` and README env vars
- [ ] Replace Whisper-via-Groq with **OpenAI Whisper API** (or HF Whisper) for voice notes
- [ ] Replace Python backend Groq call with same provider SDK
- [ ] Smoke-test each AI feature end-to-end with live keys

### 1.2 Fix hosting for FastAPI backend
Allowed: Firebase, AWS, Azure, GCP, Vercel, Netlify. FastAPI currently has no home on that list.

- [ ] Decide: **Google Cloud Run** (easiest), AWS, or port to Vercel Python functions
- [ ] If Cloud Run: write Dockerfile, deploy, wire URL into Next.js env
- [ ] If Vercel Python: confirm PDF + scipy/pingouin fit in function size limit
- [ ] Document deployment steps in README

### 1.3 Re-enable real persistence
Firebase is allowed but currently stubbed; everything is in localStorage.

- [ ] Re-enable Firebase Auth (email + Google sign-in)
- [ ] Re-enable Firestore for: projects, drafts, AI-use log, references, datasets metadata
- [ ] Migrate localStorage reads/writes to Firestore (keep localStorage as offline cache if useful)
- [ ] Add security rules (user can only read/write their own docs; adviser read-only on linked students)
- [ ] Keep OpenAlex (open API, not AI — compliant)

---

## Phase 2 — Reframe for judges

Judges ask four questions: what educational problem, why AI, who benefits, can schools use it.

- [ ] Rewrite one-paragraph problem statement:
  > Undergraduate thesis students struggle with research writing, literature search, and statistics. Advisers are overloaded and cannot give detailed feedback to every student. Buddy is a scaffolded research-writing coach that supports students between adviser meetings. Psychology / social science first, extensible to other programs.
- [ ] Why AI (put on slide): bottlenecks are language + judgment tasks rules cannot handle — understanding a draft, matching claims to literature, explaining why a statistical test fits, feedback at scale
- [ ] Beneficiaries: students (esp. ESL, limited adviser access), thesis advisers, research offices / librarians
- [ ] Accessibility story: voice notes + transcription for students who think aloud or have typing difficulty

---

## Phase 3 — Pitch-defining features

### 3.1 Coaching mode + academic integrity guardrails
Answers the "does this just write the paper?" question.

- [ ] System prompt rework: AI explains, questions, critiques — does NOT draft prose for the student
- [ ] Rubric-based feedback: score a section against clarity of hypothesis, RRL coherence, APA correctness; give suggestions, no rewrites
- [ ] **AI-use log**: visible timeline of every AI interaction (prompt summary, output type, timestamp) viewable by student and adviser

### 3.2 Adviser view
Turns Buddy from student tool into school-deployable product.

- [ ] Read-only dashboard: list of linked students, per-student section status, flagged gaps, AI-use log
- [ ] Simple invite/link flow (adviser enters student email or student shares code)

### 3.3 Citation verification
Cheap, strong responsible-AI signal.

- [ ] For each cited reference, check against OpenAlex (and/or Crossref) by DOI or title
- [ ] Show **Verified** / **Unverified** badge inline
- [ ] Block or warn on export if unverified citations remain

### 3.4 Deterministic statistics recommendation
More defensible than letting an LLM pick a test.

- [ ] Run assumption checks in Python with scipy + pingouin: normality (Shapiro), homogeneity of variance (Levene), sample size, group count, data type
- [ ] Decision tree picks the test from check results
- [ ] LLM only generates the plain-language explanation of the chosen test and result

---

## Phase 4 — Demo readiness

### 4.1 Sample educational data (hard requirement)
- [ ] Seed demo account with 2–3 sample student projects at different stages
- [ ] One clean sample dataset + one with deliberate outliers
- [ ] 2 sample PDFs for gap analysis
- [ ] One sample adviser account linked to the demo students

### 4.2 Pick the hero flow, cut the rest
Order to polish: onboarding/topic → writing with AI feedback → literature gap → stats analyzer → adviser view.

- [ ] Decide fate of node canvas: keep only if rock-solid, else hide behind menu or cut
- [ ] Remove confetti / cosmetic extras from the critical path
- [ ] Target: demo fits in the time slot with slack

### 4.3 Error handling (required)
Cover each with a visible UI state, not a silent fail:
- [ ] API timeouts + rate limits → retry with backoff, friendly message
- [ ] Streaming interruptions in chat
- [ ] Invalid / oversized file uploads
- [ ] Scanned PDFs with no extractable text
- [ ] Empty / malformed datasets, missing columns
- [ ] Backend down → clear banner, graceful degradation

### 4.4 Mocks and live-key hygiene
- [ ] Keep mock fallbacks but label them explicitly in the UI when active
- [ ] Demo environment must run with live keys
- [ ] Record a backup demo video in case venue network fails

---

## Phase 5 — Repo hygiene

- [ ] Drop branches from submission: `budai-chewy-cookie`, `hawakkoangbeat`, `lost-cause`
- [ ] Merge only the features actually demoed
- [ ] Remove unused deps: `embla-carousel`, `input-otp`, `day-picker`, `axios` (if `fetch` suffices)
- [ ] Final `npm prune` + lockfile refresh

---

## Phase 6 — Privacy, cost, limitations (Q&A ammo)

- [ ] Document (README + slides):
  - Data stored per user; API keys server-side only
  - Minimize payload sent to model
  - No training on student data
  - Philippine Data Privacy Act of 2012 awareness
  - School-account sign-in restriction if feasible
- [ ] Cost/scalability answer prepared: $/student/month, cheaper model for lightweight tasks, school deployment path
- [ ] Honest limitations slide: AI can be wrong, coach not adviser-replacement, outputs need human review

---

## Phase 7 — Deliverables

- [ ] Clean source branch
- [ ] README: setup, env vars, run Next.js + Python backend, demo accounts
- [ ] Project doc: problem, solution, features, AI components, limitations, ethics
- [ ] Architecture diagram: Next.js client → API routes → FastAPI → AI provider / OpenAlex / Firebase / hosting
- [ ] Slides built around the four judging questions
- [ ] Demo script with timing + rehearsal

---

## Suggested execution order (recap)

1. **Compliance** — swap AI provider, host FastAPI, re-enable Firebase (eligibility)
2. **Pitch features** — coaching mode + AI-use log, adviser view
3. **Trust features** — citation verification, deterministic stats checks
4. **Demo prep** — sample data, error handling, hero flow polish
5. **Deliverables** — docs, diagram, slides, rehearsal

---

## Open questions before scheduling

- Team size?
- Days until submission?
- Preferred AI provider (Claude / Gemini / OpenAI)?
- Preferred FastAPI host (Cloud Run / AWS / port to Vercel Python)?

Once answered, this plan can be turned into a dated task split per person.
