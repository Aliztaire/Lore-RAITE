# Buddy — RAITE 2026 Action Plan

Plan to address the audit feedback. Ordered by priority: compliance risks first, then pitch-defining features, then polish and deliverables.

---

## Phase 1 — Compliance (eligibility risks, do first)

### 1.1 Swap AI provider off Groq — DONE (merged from origin/master)
Groq is not on the allowed AI list. Replace everywhere.

- [x] Inventory every call site using Groq / Llama 3.3 via Groq
  - Next.js API routes (grep for `groq`, `GROQ_API_KEY`, `llama`)
  - Python backend `groq-sdk` call in literature gap analysis
- [x] Pick replacement provider: **Hugging Face** (single `HF_API_TOKEN` powers everything — text via the HF router with Llama-3.3-70B-Instruct, transcription via Whisper-large-v3)
- [x] Swap model string in each Vercel AI SDK call (`lib/hf.ts` + `@ai-sdk/openai-compatible` pointed at the HF router)
- [x] Update `.env.example` and README env vars
- [x] Replace Whisper-via-Groq with HF's Whisper-large-v3 endpoint for voice notes
- [x] Replace Python backend Groq call with HF router (stdlib `urllib`, no SDK needed)
- [ ] Smoke-test each AI feature end-to-end with live keys — `HF_API_TOKEN` is set in `.env.local` but not yet exercised live through every route; do this next

### 1.2 Fix hosting for FastAPI backend — DONE
Allowed: Firebase, AWS, Azure, GCP, Vercel, Netlify. FastAPI currently has no home on that list.

- [x] Decide: **Vercel Python functions** (same project/domain as the Next.js app — no CORS, no second URL)
- [x] Confirm PDF + scipy/pingouin fit in function size limit — trimmed unused `matplotlib`/`seaborn`/`scikit-learn`; real fit still needs a live Vercel deploy to fully confirm, Cloud Run is the documented fallback if it doesn't
- [x] Document deployment steps in README

### 1.3 Re-enable real persistence — DONE
Firebase is allowed but currently stubbed; everything is in localStorage.

- [x] Re-enable Firebase Auth (email + Google sign-in)
- [x] Re-enable Firestore for projects (drafts/references are nested fields on `Project`, persist for free; AI-use log and dataset metadata don't exist as features yet — deferred to whenever Phase 3.1 / stats work actually lands)
- [x] Migrate localStorage reads/writes to Firestore (decided not to keep a localStorage offline cache on top — login-gated Firestore persistence is the compliance-critical part)
- [x] Add security rules (user can only read/write their own docs); adviser read-only access is a `TODO(3.2)` in `firestore.rules`, waiting on the adviser-linking feature itself
- [x] Keep OpenAlex (open API, not AI — compliant)

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

## Phase 8 — Mobile / PWA quick-accessibility (bonus-points track, not compliance)

Not required for eligibility — targets the rules deck's bonus-point criteria ("Offline capability," "Accessibility features"). Scoped as a PWA (installable Next.js app), not a separate native app — reuses the existing voice-notes feature rather than building a second codebase.

### 8.1 Installable shell
- [ ] `app/manifest.ts` (Next metadata route) + generated icon set from existing `public/BUDDY_LOGO_CIRCLE.png`
- [ ] `app/apple-icon.tsx` (mirrors existing `app/icon.tsx` pattern)
- [ ] Hand-written `public/sw.js` registered via a small client component — **not** `next-pwa`, since Next 16's default Turbopack doesn't run the webpack hooks that plugin needs
- [ ] "Install App" button using `beforeinstallprompt` (absent on browsers without support, e.g. iOS — no dead button)

### 8.2 Offline mode
- [ ] Service worker: network-first shell with offline fallback, stale-while-revalidate for static assets, `/api/*` and Firebase calls always bypass the cache
- [ ] Offline voice-note queue: if transcription fails while offline, store the audio as base64 in the existing `voiceNotes` localStorage array (`pendingAudioBase64` / `transcriptionStatus`), auto-retry on the `online` event
- [ ] Documented limitation: localStorage queue sized for a handful of short clips, not a general offline blob store

### 8.3 Home-screen quick-capture
- [ ] Manifest `shortcuts` entry deep-linking to `/?quickCapture=voice` (Android/Windows; no iOS support — documented)
- [ ] `app/page.tsx` reads that query param, opens the voice-note panel, and auto-starts recording

### 8.4 Text-to-speech playback
- [ ] `hooks/use-text-to-speech.ts` wrapping the native Web Speech API (`speechSynthesis`) — no new dependency, works offline
- [ ] "Read Aloud" button on saved voice notes and on the writing-view section header (strips Markdown first via a small helper, since section content is stored as Markdown)

### Known limitations (document in README)
- iOS Safari: no `beforeinstallprompt`, no manifest `shortcuts` — install is manual via Share menu, no quick-capture shortcut
- `signInWithPopup` can behave oddly in an installed/standalone PWA window on some mobile browsers — not fixed in this pass, `signInWithRedirect` would be the follow-up if it comes up
- The service worker makes the shell resilient and installable, not a guarantee every feature works fully offline (AI calls and Firestore sync still need network)

---

## Suggested execution order (recap)

1. **Compliance** — swap AI provider, host FastAPI, re-enable Firebase (eligibility)
2. **Pitch features** — coaching mode + AI-use log, adviser view
3. **Trust features** — citation verification, deterministic stats checks
4. **Demo prep** — sample data, error handling, hero flow polish
5. **Deliverables** — docs, diagram, slides, rehearsal

---

## Open questions before scheduling

- Team size: 4
- Days until submission: 1
- Preferred AI provider (Claude / Gemini / OpenAI): Huggingface 
- Preferred FastAPI host (Cloud Run / AWS / port to Vercel Python)? Vercel Python

Once answered, this plan can be turned into a dated task split per person.
