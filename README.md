# Lore-RAITE

> Fork of **Buddy** (an AI research-writing assistant), being refactored into a new hackathon project.
>
> This repo starts from Buddy's codebase and will be *extensively* modified. This README is the single source of truth for the current state — **read it fully before changing anything**, especially if you are an AI agent.

---

## What this project *was* (Buddy — origin)

Buddy was an AI research assistant for psychology / social-science students writing empirical papers (hypothesis + Review of Related Literature + stats). It wrapped the full workflow — topic framing → literature discovery → outlining → writing → statistical analysis → `.docx` export — in a single Next.js app with a Python/FastAPI companion backend for heavy work.

The product flow:
1. **Onboarding** — enter a topic, AI asks 5 clarifying questions, system recommends seminal papers via OpenAlex.
2. **Overview** — section progress, word counts, outline and references side by side.
3. **Concept map** (canvas) — force-directed graph of sections / concepts / evidence with typed edges (*supports / contradicts / references / elaborates*), opened from Overview's tool buttons.
4. **Write** — TipTap rich-text editor with a floating section outline, inline citations, and assistant answers as comments on the page.
5. **Data Analysis** — upload Excel, get a recommended statistical test (t-test, ANOVA, Mann-Whitney, Kruskal-Wallis) with outlier cleaning.
6. **Literature** — PDF upload + literature-gap analysis.
7. **Export** — Word doc with APA 7 bibliography.

This forms the *shell* you are inheriting. Which parts survive the hackathon pivot depends on the new direction — see **"Pivoting this codebase"** below.

---

## Current state of the repo (what runs today)

### Requires real credentials to get past login

Firebase Auth (Google + email/password) and Firestore (project persistence) are **live**, not stubbed — `lib/firebase.ts`, `lib/firestore-service.ts`, and `components/auth-provider.tsx` all talk to a real Firebase project. `app/page.tsx` redirects unauthenticated users to `/login`. Without a real Firebase project and the `NEXT_PUBLIC_FIREBASE_*` vars filled in `.env.local`, the app won't get past the login screen. See `.env.example` for the full setup checklist (create a project, enable Google + Email/Password sign-in, enable Firestore, publish `firestore.rules`).

### What still runs with no AI credentials

- **All 5 AI API routes** (`chat`, `onboarding`, `suggest-title`, `find-reference`, `transcribe`) short-circuit to mock responses when `HF_API_TOKEN` is not set. One Hugging Face token powers everything — text via the HF router (Llama 3.3 70B Instruct) and transcription via Whisper-large-v3.
- **OpenAlex** calls still work (no key needed) — onboarding recommendations and chat tool-calling still return real papers.

### Known loose ends

- `lib/firestore.ts` is an unused standalone test file (adds a doc to `testCollection`). Kept for reference; safe to delete.
- `tsconfig.tsbuildinfo` was previously committed; it is now in `.gitignore` and untracked.
- `app/api/analyze-connections` is referenced in some branches but is not fully implemented on `master`.
- `firestore.rules` only covers the `projects` collection (what's actually built). The adviser-linking feature (planned, not yet implemented) will need its own rule added — see the `TODO(3.2)` comment in that file.

---

## Running locally

### Prereqs
- Node.js **≥ 20** (project targets Next 16 / React 19)
- npm (lockfile is npm)
- Python **3.11+** (only if you need the stats / lit-gap backend)

### Frontend
```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_FIREBASE_* — required, see below
npm run dev                  # http://localhost:3000
```
You need a real Firebase project to get past `/login` — see "Firebase setup" below. `HF_API_TOKEN` can stay blank (AI routes fall back to mock responses).

### Firebase setup (required)
1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method** — enable **Google** and **Email/Password**.
3. **Firestore Database** — create a database, start in **production mode**.
4. **Project settings → General → Your apps** — register a web app, copy the config values into the 7 `NEXT_PUBLIC_FIREBASE_*` vars in `.env.local`.
5. Publish `firestore.rules` (paste its contents into the Firestore **Rules** tab and click Publish, or `npx firebase-tools login && npx firebase-tools deploy --only firestore:rules,firestore:indexes` once `.firebaserc`'s `default` project ID is set to yours).

### Python backend (optional — needed for Analyzer and Literature views)
```bash
cd api
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
In dev, the frontend calls relative `/api/analyze` and `/api/analyze-literature` paths; `next.config.mjs` rewrites those to `http://localhost:8000` for you — no need to touch frontend code. In production (Vercel), those same paths are served directly by `api/analyze.py` / `api/analyze-literature.py` as Vercel Python Functions, no separate backend URL needed. Backend reads `HF_API_TOKEN` from the project-root `.env.local`.

### Build
```bash
npm run build
npm start
```

---

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router, Turbopack) — one Vercel deployment   │
│                                                                │
│  app/page.tsx — single-page shell, switches viewMode:         │
│    dashboard | canvas | writing | literature | analyzer       │
│                                                                │
│  State: Zustand store (lib/store.ts) ──────► Firestore         │
│    (projects synced via lib/firestore-service.ts)             │
│                                                                │
│  components/auth-provider.tsx ──────► Firebase Auth            │
│    (Google + email/password)                                  │
│                                                                │
│  app/api/* — Next route handlers (Node functions)             │
│    chat / onboarding / suggest-title /                        │
│    find-reference / transcribe                                │
│         │                                                     │
│         ├─► Hugging Face router (Llama-3.3-70B-Instruct)      │
│         ├─► Hugging Face Whisper-large-v3 (transcribe)        │
│         └─► OpenAlex REST (api.openalex.org/works)            │
│                                                                │
│  /api/analyze, /api/analyze-literature — relative fetch calls │
└──────────────────────────┬─────────────────────────────────────┘
                            │ same origin, same deployment
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Vercel Python Functions (api/analyze.py, api/analyze-        │
│  literature.py — see api/_lib/ for shared logic)               │
│    POST /api/analyze            — scipy/pingouin test picker  │
│    POST /api/analyze-literature — HF Llama + PyMuPDF gap check│
└──────────────────────────────────────────────────────────────┘
```

Locally, `api/main.py` runs the same `_lib` logic behind one `uvicorn` server on `:8000`, and `next.config.mjs` rewrites `/api/analyze*` to it in dev only — see "Python backend" below.

---

## Repository layout

```
.
├─ app/
│  ├─ page.tsx          ← main shell; viewMode switcher; quick-capture deep link (Phase 8: on HostDB, not yet merged here)
│  ├─ layout.tsx        ← AuthProvider + PwaRegister + fonts + Analytics (Phase 8: on HostDB, not yet merged here)
│  ├─ globals.css       ← Tailwind v4 + theme vars
│  ├─ icon.tsx
│  ├─ apple-icon.tsx    ← PWA home-screen icon (iOS) (Phase 8: on HostDB, not yet merged here)
│  ├─ manifest.ts       ← PWA manifest (installable, shortcuts) (Phase 8: on HostDB, not yet merged here)
│  ├─ login/page.tsx    ← Google + email/password sign-in
│  └─ api/
│     ├─ chat/route.ts            ← streaming chat + OpenAlex tool
│     ├─ onboarding/route.ts      ← questions + RRW recs
│     ├─ suggest-title/route.ts   ← 3 alt titles
│     ├─ find-reference/route.ts  ← pick ref index for a sentence
│     └─ transcribe/route.ts      ← Whisper audio→text
│
├─ components/
│  ├─ buddy/            ← all feature UI (see table below)
│  ├─ ui/               ← shadcn/Radix primitives
│  ├─ Analyzer.tsx      ← statistical analysis UI
│  ├─ auth-provider.tsx ← real Firebase Auth (onAuthStateChanged)
│  ├─ pwa-register.tsx  ← registers public/sw.js (Phase 8: on HostDB, not yet merged here)
│  └─ theme-provider.tsx
│
├─ lib/
│  ├─ store.ts              ← Zustand store (THE state)
│  ├─ types.ts              ← domain model (Project/Section/Reference/…)
│  ├─ export.ts             ← .docx generation
│  ├─ firebase.ts           ← real Firebase init (Auth + Firestore)
│  ├─ firestore-service.ts  ← real Firestore CRUD for the `projects` collection
│  ├─ firestore.ts          ← legacy test file; unused
│  ├─ strip-markup.ts       ← Markdown/HTML → plain text, for read-aloud (Phase 8: on HostDB, not yet merged here)
│  └─ utils.ts              ← cn() etc.
│
├─ hooks/                             ← custom React hooks
│  ├─ use-text-to-speech.ts           ← wraps window.speechSynthesis (Phase 8: on HostDB, not yet merged here)
│  └─ use-sync-pending-voice-notes.ts ← retries offline-queued transcriptions (Phase 8: on HostDB, not yet merged here)
├─ public/
│  └─ icons/, sw.js                   ← PWA icon set + hand-written service worker (Phase 8: on HostDB, not yet merged here)
│
├─ api/                     ← Python backend — hosted as Vercel Python Functions
│  ├─ analyze.py            ← Vercel entrypoint: POST /api/analyze
│  ├─ analyze-literature.py ← Vercel entrypoint: POST /api/analyze-literature
│  ├─ _lib/                 ← shared logic imported by both entrypoints + main.py
│  │  ├─ stats.py           ← stats test picker (clean_group, analyze_data)
│  │  └─ literature.py      ← lit-gap analyzer (PDF extract, HF router call)
│  ├─ main.py               ← local-dev only: mounts both under one uvicorn server
│  ├─ requirements.txt
│  └─ README.md
│
├─ firestore.rules          ← security rules (projects owned by userId)
├─ firestore.indexes.json   ← composite index for the projects query
├─ firebase.json / .firebaserc
├─ vercel.json              ← maxDuration for the two Python functions
├─ next.config.mjs          ← dev-only rewrite: /api/analyze* → localhost:8000
├─ .env.example
├─ .gitignore
├─ next-env.d.ts
├─ package.json             ← Next 16.1.6, React 19.2.4
├─ postcss.config.mjs       ← Tailwind v4
└─ tsconfig.json
```

### Feature components (`components/buddy/`)

| File | Role |
|---|---|
| `onboarding.tsx` | Multi-step wizard: topic → AI questions → RRW recommendations → project creation |
| `dashboard-overview.tsx` | Progress, word counts, tool buttons, outline + references, title-suggestion dialog |
| `app-sidebar.tsx` / `navigation.ts` | Left sidebar (project switcher, nav, theme, profile); nav config for adding views |
| `writing-view.tsx` | TipTap editor, inline images, citation insertion, voice-note side panel, read-section-aloud |
| `node-canvas.tsx` | Concept map: force-directed graph, typed edges, custom nodes (line-art styling) |
| `voice-note-taker.tsx` | MediaRecorder → Whisper → tagged notes; offline queue + read-aloud (see "Mobile / PWA" below) |
| `install-app-button.tsx` | "Install App" button, only renders when the browser fires `beforeinstallprompt` | (Phase 8: on HostDB, not yet merged here)
| `global-ai-chat.tsx` | Streaming chat sidebar with OpenAlex scholarly-search tool |
| `checklist-sidebar.tsx` | Per-section completion + AI notes |
| `integrated-literature-analyzer.tsx` | PDF upload → Python `/analyze-literature` |
| `document-preview-modal.tsx` | Live `.docx` preview before download |
| `project-switcher.tsx` | Dropdown to switch / create projects |
| `user-profile.tsx` | Mock user display (sign-out stub) |

---

## Domain model (`lib/types.ts`)

```ts
Project {
  id, title, topic, createdAt, updatedAt
  outline: { introduction, body[], conclusion }
  nodes[], edges[]
  bibliography: string[]        // Reference IDs
}

OutlineSection {
  id, title, description, content
  completed: boolean
  references: Reference[]
  aiNotes: string[]
}

Reference {
  id, title, authors[], year
  type: 'article' | 'book' | 'website' | 'other'
  citation: string              // APA 7
  doi?, journal?, volume?, issue?, pages?, notes
}

CanvasNode { id, type: 'section'|'concept'|'evidence', label, x, y, data{...} }
CanvasEdge { id, source, target, label: 'supports'|'contradicts'|'references'|'elaborates' }
VoiceNote  { id, content, tag?, createdAt }
ChatMessage{ id, role, content, timestamp, sectionId? }
ViewMode   = 'dashboard'|'canvas'|'writing'|'literature'|'analyzer'
```

---

## State (`lib/store.ts`)

Single Zustand store, persisted to `localStorage`. Groups:

- **User & projects**: `userId`, `projects[]`, `currentProjectId` + CRUD actions.
- **UI**: `viewMode`, `selectedSectionId`, `focusMode`, chat-sidebar pin/width/open flags.
- **Chat**: `chatSessions[]` (named threads with UIMessage history), `activeChatId`, `globalChat[]`.
- **Canvas**: `nodes[]`, `edges[]` on each project, plus node/edge actions.
- **Bibliography**: `bibliography[]` on each project (reference IDs marked for use).
- **Persistence**: `version: 1` with a `migrate()` that resets unknown views; extend it when the persisted shape changes.
- **Voice**: `voiceNotes[]` + panel open flag.

Every mutating action also fires `firestoreService.updateProject(...)`, which now really writes to Firestore (fire-and-forget, no debouncing) whenever `userId` is set.

---

## API surface

### Next.js routes (`app/api/*`)
| Route | Method | Behaviour (real) | Behaviour (no `HF_API_TOKEN`) |
|---|---|---|---|
| `/api/chat` | POST | HF Llama streaming chat w/ OpenAlex tool | Mock stream, text explaining bypass |
| `/api/onboarding` | POST (`step: 'questions' \| 'recommend'`) | HF Llama questions + OpenAlex papers + HF Llama RRW | Hard-coded fallback questions + OpenAlex only |
| `/api/suggest-title` | POST | 3 HF Llama-generated titles | Templated titles from input |
| `/api/find-reference` | POST | HF Llama picks best reference index | Returns first reference ID |
| `/api/transcribe` | POST (multipart) | HF Whisper-large-v3 transcription | `"[transcription bypassed …]"` |

### Python backend (`api/`)
| Endpoint | Purpose | Deps | Hosting |
|---|---|---|---|
| `POST /api/analyze` | Excel → cleaning (IQR outliers) → stats test recommendation | pandas, scipy, pingouin | `api/analyze.py` (Vercel Python Function) |
| `POST /api/analyze-literature` | PDFs + draft → gap analysis | PyMuPDF, stdlib (HF router via HTTPS) | `api/analyze-literature.py` (Vercel Python Function) |

Both call into shared logic in `api/_lib/` — see "Repository layout" above.

---

## Mobile / PWA (bonus-points feature, `PLAN.md` Phase 8)

> **Status on this branch:** Phase 8 is implemented on the `HostDB` branch but has **not** been merged into this UI-redesign branch yet (only PLAN.md Phase 1 was ported). The files described below do not exist here until it is.

Not required for eligibility — the rules deck lists "Offline capability" and "Accessibility
features" as bonus-point criteria, not requirements. Built as a **PWA** (installable
Next.js app) rather than a separate native app, so it reuses the existing codebase
entirely instead of standing up a second one with its own auth/API wiring.

- **Installable**: `app/manifest.ts` + `app/apple-icon.tsx` (mirrors the existing (Phase 8: on HostDB, not yet merged here)
  `app/icon.tsx` convention) + icons generated from `public/BUDDY_LOGO_CIRCLE.png` under
  `public/icons/`. An "Install App" button (`components/buddy/install-app-button.tsx`) (Phase 8: on HostDB, not yet merged here)
  appears in the dashboard header on browsers that support it.
- **Offline-resilient shell**: `public/sw.js` is a hand-written service worker — **not**
  `next-pwa`/`serwist`, since Next 16's default Turbopack doesn't run the webpack hooks
  those plugins rely on to generate a worker at build time. Network-first for the page
  itself with a cached-shell fallback, stale-while-revalidate for static assets; `/api/*`
  and Firebase traffic always bypass the cache. This makes the installed app resilient to
  flaky connections and open-to-something when offline — it is **not** a full offline-first
  rewrite (AI calls and Firestore sync still need a connection).
- **Offline voice-note queue**: if `/api/transcribe` fails while offline,
  `voice-note-taker.tsx` stores the raw audio as base64 in the existing
  localStorage-persisted `voiceNotes` array (`VoiceNote.pendingAudioBase64` /
  `transcriptionStatus`) instead of showing a hard error. `hooks/use-sync-pending-voice-
  notes.ts` retries on the browser's `online` event; there's also a manual retry button on
  pending notes. This is a localStorage queue sized for a handful of short clips, not a
  general-purpose offline blob store (no IndexedDB).
- **Home-screen quick-capture**: the manifest's `shortcuts` entry deep-links to
  `/?quickCapture=voice`; `app/page.tsx` reads that param once and opens the voice-note
  panel with `autoStartRecording` set, which `voice-note-taker.tsx` picks up to start
  recording immediately. Needs an existing project to land on (voice notes open from
  inside the project workspace) — if there's no project yet, the flags still land and
  apply once one is created.
- **Read-aloud (text-to-speech)**: `hooks/use-text-to-speech.ts` wraps the native (Phase 8: on HostDB, not yet merged here)
  `window.speechSynthesis` API — no new dependency, works offline. Wired into saved voice
  notes and the writing-view section header (via `lib/strip-markup.ts`, since section (Phase 8: on HostDB, not yet merged here)
  content is stored as Markdown).

**Known limitations**:
- iOS Safari supports neither `beforeinstallprompt` nor manifest `shortcuts` — install is
  manual via Share → "Add to Home Screen," and the quick-capture shortcut isn't available
  there.
- Firebase `signInWithPopup` can behave oddly inside an installed/standalone PWA window on
  some mobile browsers. Not fixed in this pass — `signInWithRedirect` would be the fix if
  it comes up.

---

## Tech stack

**Frontend**
- Next.js **16.1.6** (App Router, Turbopack) · React **19.2.4** · TypeScript **5.7**
- Tailwind CSS **v4** (`@tailwindcss/postcss`) + `tw-animate-css`

**UI**
- 6 Radix UI primitives · the 9 shadcn/ui wrappers the app uses in `components/ui/` · Lucide icons
- `next-themes` (light/dark) · `motion` (screen transitions)
- `class-variance-authority` + `clsx` + `tailwind-merge`

**State & forms**
- Zustand **5** (persist to localStorage) · Zod

**AI**
- Vercel AI SDK **v6** (`ai`, `@ai-sdk/react`) · `@ai-sdk/openai-compatible`
- Hugging Face Inference Providers router — `meta-llama/Llama-3.3-70B-Instruct` for text, `openai/whisper-large-v3` for audio
- OpenAlex REST (no key) for scholarly search

**Editor & export**
- TipTap **3** (starter-kit, image, placeholder, pm) + `tiptap-markdown` · `react-markdown`
- `docx` (Word export) · `xlsx` (Excel import)

**Networking / utils**
- `axios`

**Auth & persistence**
- Firebase **12** (Auth: Google + email/password; Firestore: per-user `projects` collection)

**Analytics**
- `@vercel/analytics`

**Mobile / PWA**
- Hand-written service worker (`public/sw.js`) + Next's native `manifest.ts`/`apple-icon.tsx` metadata routes — no `next-pwa`/workbox dependency (Phase 8: on HostDB, not yet merged here)
- Native Web Speech API (`window.speechSynthesis`) for read-aloud — no new dependency

**Python backend**
- FastAPI · Uvicorn · scipy · pandas · numpy · pingouin · PyMuPDF · python-dotenv (HF called via stdlib urllib)

---

## Pivoting this codebase — guidance for agents

If you are an AI agent (or a human) picking this up for the new hackathon, read this before editing:

### Safe starting points
1. **The shell is reusable.** `app/page.tsx` + the viewMode pattern + the Zustand store + the Radix/shadcn UI kit give you a working app frame. Rip out the Buddy-specific feature components under `components/buddy/` and the API routes as needed, but keep the chassis.
2. **AI plumbing is in place.** AI SDK v6 streaming is already wired up in `app/api/chat/route.ts` with tool-calling. Swap the system prompt, swap the tool, keep the structure.
3. **The Python backend is a separate process** on `:8000`. If you don't need Python stats, delete the `api/` folder and the two components that call it (`Analyzer.tsx`, `components/buddy/integrated-literature-analyzer.tsx`).

### Hazards
- **Zustand store is coupled to the `Project` schema** in `lib/types.ts`. Changing the domain model means touching ~15 call sites in `lib/store.ts`. Prefer a new store file over mutating the existing one if the new product has a different core entity.
- **Every mutating action calls `firestoreService.*`, and it's live.** There's no debouncing — rapid edits (e.g. typing in the TipTap editor, if it's wired to `updateSection` per keystroke) will write to Firestore on every call. Add debouncing before that becomes a cost/quota problem.
- **TipTap and the canvas** carry significant surface area. If you don't need rich text or node graphs, delete `writing-view.tsx` / `node-canvas.tsx` plus their deps (`@tiptap/*`, `tiptap-markdown`).
- **Firebase/Hugging Face/OpenAlex names leak into UI copy.** Grep before renaming the product; strings like "Buddy", "RRL", "RRW" appear across onboarding and dashboard.
- **npm, not pnpm/yarn.** Lockfile is `package-lock.json`. Don't switch package managers mid-hackathon.

### Common first moves for a pivot
```bash
# strip Buddy-specific features
rm -rf components/buddy app/api/{chat,onboarding,suggest-title,find-reference,transcribe}

# strip Python backend if not needed
rm -rf api components/Analyzer.tsx components/buddy/integrated-literature-analyzer.tsx

# strip rich-text editor
npm uninstall @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-placeholder @tiptap/pm tiptap-markdown
rm components/buddy/writing-view.tsx

# strip Firebase entirely
npm uninstall firebase
rm lib/firebase.ts lib/firestore.ts lib/firestore-service.ts
# then remove firebase imports from components/auth-provider.tsx
```

### Branches to mine from origin (if useful)
The upstream `yeruka-ui/GDG-Research-Hackathon` repo has 14 feature branches — some are worth cherry-picking features from:

| Branch | What it contains |
|---|---|
| `AI-Integration` | Enhanced Groq usage / tool calls |
| `authentication` | Real Firebase auth implementation |
| `voice-module` | Voice note recording + Whisper |
| `lit-gap-analyzer` | Literature-gap UI + backend |
| `clash-detector` | Conflict detection (likely canvas-related) |
| `psych-test-processing` | Analyzer / stats logic |
| `rrl-reference-fuctions` | APA/reference utilities |
| `ui-redesign` | UI/UX refresh |
| `image-persistence` | Image storage |

To fetch from upstream:
```bash
git remote add upstream https://github.com/yeruka-ui/GDG-Research-Hackathon.git
git fetch upstream
git checkout -b feature-name upstream/<branch-name>
```

---

## Scripts

```bash
npm run dev     # Next dev (Turbopack) on :3000
npm run build   # Production build
npm run start   # Serve build
npm run lint    # ESLint
```

---

## Deployment

Everything — Next.js app and Python backend — deploys as **one Vercel project**. `vercel link` then push; Vercel auto-detects the framework (Next.js) and separately picks up `api/analyze.py` / `api/analyze-literature.py` as Python Serverless Functions (detected via the presence of `api/requirements.txt`).

Expected env vars in Vercel project settings:
- `HF_API_TOKEN`
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` — same values as `.env.local`

Also add your production domain to Firebase **Authentication → Settings → Authorized domains**, or Google sign-in will be rejected there even though it works on `localhost`.

**Size-limit risk**: `api/requirements.txt` pulls in pandas/scipy/pingouin/PyMuPDF, which can approach Vercel's per-function unzipped size cap. `matplotlib`, `seaborn`, and `scikit-learn` were already trimmed out as unused dead weight. If a deploy still fails on function size, the fallback is Google Cloud Run (Dockerfile + wire the Cloud Run URL into an env var instead of using relative `/api/...` paths) — don't fight the package size indefinitely.

Firestore rules/indexes aren't part of the Vercel deploy — publish them separately: `npx firebase-tools login && npx firebase-tools deploy --only firestore:rules,firestore:indexes` (after setting `.firebaserc`'s `default` to your real project ID), or paste `firestore.rules` into the console's Rules tab.

---

## License

TBD by the Lore-RAITE team.
