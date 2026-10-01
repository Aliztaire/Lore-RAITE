# Lore-RAITE

> Fork of **Buddy** (an AI research-writing assistant), being refactored into a new hackathon project.
>
> This repo starts from Buddy's codebase and will be *extensively* modified. This README is the single source of truth for the current state — **read it fully before changing anything**, especially if you are an AI agent.

---

## What this project *was* (Buddy — origin)

Buddy was an AI research assistant for psychology / social-science students writing empirical papers (hypothesis + Review of Related Literature + stats). It wrapped the full workflow — topic framing → literature discovery → outlining → writing → statistical analysis → `.docx` export — in a single Next.js app with a Python/FastAPI companion backend for heavy work.

The product flow:
1. **Onboarding** — enter a topic, AI asks 5 clarifying questions, system recommends seminal papers via OpenAlex.
2. **Dashboard** — section progress, word counts, next-action nudges.
3. **Canvas** — force-directed graph of sections / concepts / evidence with typed edges (*supports / contradicts / references / elaborates*).
4. **Writing** — TipTap rich-text editor with inline citations and voice notes.
5. **Analyzer** — upload Excel, get a recommended statistical test (t-test, ANOVA, Mann-Whitney, Kruskal-Wallis) with outlier cleaning.
6. **Literature** — PDF upload + literature-gap analysis.
7. **Export** — Word doc with APA 7 bibliography.

This forms the *shell* you are inheriting. Which parts survive the hackathon pivot depends on the new direction — see **"Pivoting this codebase"** below.

---

## Current state of the repo (what runs today)

### What works out of the box, with **no credentials**

The repo was intentionally bypassed so a fresh clone runs with `npm install && npm run dev` and nothing else:

- **Firebase is stubbed.** `lib/firebase.ts`, `lib/firestore-service.ts`, and `components/auth-provider.tsx` no longer touch Firebase. A mock user (`local-dev-user`) is "signed in" and projects persist via Zustand's `localStorage` middleware.
- **`app/login/page.tsx`** redirects to `/`.
- **All 5 AI API routes** (`chat`, `onboarding`, `suggest-title`, `find-reference`, `transcribe`) short-circuit to mock responses when `HF_API_TOKEN` is not set. One Hugging Face token powers everything — text via the HF router (Llama 3.3 70B Instruct) and transcription via Whisper-large-v3.
- **OpenAlex** calls still work (no key needed) — onboarding recommendations and chat tool-calling still return real papers.

### What needs real credentials

- Set `HF_API_TOKEN` in `.env.local` to re-enable real AI generation and voice-note transcription (one token, both uses).
- To re-enable Firebase sync (Google OAuth + Firestore project storage), restore the original versions of the three stubbed files from git history (`git log -- lib/firebase.ts`) and fill in the `NEXT_PUBLIC_FIREBASE_*` vars.

### Known loose ends

- `lib/firestore.ts` is an unused standalone test file (adds a doc to `testCollection`). Kept for reference; safe to delete.
- `tsconfig.tsbuildinfo` was previously committed; it is now in `.gitignore` and untracked.
- `app/api/analyze-connections` is referenced in some branches but is not fully implemented on `master`.

---

## Running locally

### Prereqs
- Node.js **≥ 20** (project targets Next 16 / React 19)
- npm (lockfile is npm)
- Python **3.11+** (only if you need the stats / lit-gap backend)

### Frontend
```bash
npm install
cp .env.example .env.local   # optional — leave blank for mock mode
npm run dev                  # http://localhost:3000
```

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
The frontend calls `http://localhost:8000`. Backend reads `HF_API_TOKEN` from the project-root `.env.local`.

### Build
```bash
npm run build
npm start
```

---

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router, Turbopack) — localhost:3000     │
│                                                          │
│  app/page.tsx — single-page shell, switches viewMode:    │
│    dashboard | canvas | writing | literature | analyzer  │
│                                                          │
│  State: Zustand store (lib/store.ts, localStorage persist)│
│                                                          │
│  app/api/* — Next route handlers                         │
│    chat / onboarding / suggest-title /                   │
│    find-reference / transcribe                           │
│         │                                                │
│         ├─► Hugging Face router (Llama-3.3-70B-Instruct) │
│         ├─► Hugging Face Whisper-large-v3 (transcribe)   │
│         └─► OpenAlex REST (api.openalex.org/works)       │
│                                                          │
│  Firebase (stubbed) — intended for Auth + Firestore sync │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼ (axios/fetch)
┌──────────────────────────────────────────────────────────┐
│  Python FastAPI — localhost:8000                         │
│    POST /analyze           — scipy/pingouin test picker  │
│    POST /analyze-literature — HF Llama + PyMuPDF gaps    │
└──────────────────────────────────────────────────────────┘
```

---

## Repository layout

```
.
├─ app/
│  ├─ page.tsx          ← main shell; viewMode switcher
│  ├─ layout.tsx        ← AuthProvider + fonts + Analytics
│  ├─ globals.css       ← Tailwind v4 + theme vars
│  ├─ icon.tsx
│  ├─ login/page.tsx    ← redirect-to-/ stub
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
│  ├─ auth-provider.tsx ← mock auth (stub)
│  └─ theme-provider.tsx
│
├─ lib/
│  ├─ store.ts              ← Zustand store (THE state)
│  ├─ types.ts              ← domain model (Project/Section/Reference/…)
│  ├─ export.ts             ← .docx generation
│  ├─ firebase.ts           ← STUB
│  ├─ firestore-service.ts  ← STUB (returns [] / no-ops)
│  ├─ firestore.ts          ← legacy test file; unused
│  └─ utils.ts              ← cn() etc.
│
├─ hooks/                   ← custom React hooks
├─ public/                  ← logos
│
├─ api/                     ← Python FastAPI backend
│  ├─ main.py
│  ├─ requirements.txt
│  └─ README.md
│
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
| `dashboard-overview.tsx` | Progress bars, word counts, title-suggestion modal, confetti on completion |
| `dashboard-header.tsx` | Top nav: project switcher, viewMode tabs, export/preview |
| `writing-view.tsx` | TipTap editor, inline images, citation insertion, voice-note side panel |
| `node-canvas.tsx` | Force-directed graph; drag/edit nodes; typed edges |
| `voice-note-taker.tsx` | MediaRecorder → Whisper → tagged notes (Idea / To-Do / Source) |
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
- **Canvas**: `nodes[]`, `edges[]`, `bibliography[]`.
- **Voice**: `voiceNotes[]` + panel open flag.

Every mutating action also fires `firestoreService.updateProject(...)` — currently a no-op (see stubs).

---

## API surface

### Next.js routes (`app/api/*`)
| Route | Method | Behaviour (real) | Behaviour (no `GROQ_API_KEY`) |
|---|---|---|---|
| `/api/chat` | POST | HF Llama streaming chat w/ OpenAlex tool | Mock stream, text explaining bypass |
| `/api/onboarding` | POST (`step: 'questions' \| 'recommend'`) | HF Llama questions + OpenAlex papers + HF Llama RRW | Hard-coded fallback questions + OpenAlex only |
| `/api/suggest-title` | POST | 3 HF Llama-generated titles | Templated titles from input |
| `/api/find-reference` | POST | HF Llama picks best reference index | Returns first reference ID |
| `/api/transcribe` | POST (multipart) | HF Whisper-large-v3 transcription | `"[transcription bypassed …]"` |

### Python backend (`api/`)
| Endpoint | Purpose | Deps |
|---|---|---|
| `POST /analyze` | Excel → cleaning (IQR outliers) → stats test recommendation | pandas, scipy, pingouin |
| `POST /analyze-literature` | PDFs + draft → gap analysis | PyMuPDF, stdlib (HF router via HTTPS) |

---

## Tech stack

**Frontend**
- Next.js **16.1.6** (App Router, Turbopack) · React **19.2.4** · TypeScript **5.7**
- Tailwind CSS **v4** (`@tailwindcss/postcss`) + `tw-animate-css`

**UI**
- ~25 Radix UI primitives · shadcn/ui wrappers in `components/ui/` · Lucide icons
- `sonner`, `vaul`, `cmdk`, `embla-carousel-react`, `react-resizable-panels`, `input-otp`, `react-day-picker`
- `next-themes`, `canvas-confetti`
- `class-variance-authority` + `clsx` + `tailwind-merge`

**State & forms**
- Zustand **5** (persist to localStorage) · React Hook Form + `@hookform/resolvers` · Zod

**AI**
- Vercel AI SDK **v6** (`ai`, `@ai-sdk/react`) · `@ai-sdk/openai-compatible`
- Hugging Face Inference Providers router — `meta-llama/Llama-3.3-70B-Instruct` for text, `openai/whisper-large-v3` for audio
- OpenAlex REST (no key) for scholarly search

**Editor & export**
- TipTap **3** (starter-kit, image, placeholder, pm) + `tiptap-markdown` · `react-markdown`
- `docx` (Word export) · `xlsx` (Excel import) · `recharts`

**Networking / utils**
- `axios` · `date-fns`

**Auth & persistence (stubbed)**
- Firebase **12** (Auth + Firestore)

**Analytics**
- `@vercel/analytics`

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
- **Every mutating action calls `firestoreService.*`.** It's a no-op now, but if you re-enable Firebase, you'll start writing to Firestore on every keystroke. Either keep the stub or add debouncing.
- **TipTap and canvas** carry significant surface area. If you don't need rich-text or node graphs, delete `writing-view.tsx` and `node-canvas.tsx` plus their deps (`@tiptap/*`, `tiptap-markdown`) — saves ~15 dependencies.
- **Firebase/Groq/OpenAlex names leak into UI copy.** Grep before renaming the product; strings like "Buddy", "RRL", "RRW" appear across onboarding and dashboard.
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

Designed for Vercel (next.js). Expected env vars in Vercel project settings:
- `HF_API_TOKEN`
- `NEXT_PUBLIC_FIREBASE_*` (only if you re-enable Firebase)

The Python backend is **not** deployable as a Vercel Next route — host it separately (Fly, Railway, Render, or convert endpoints into Next route handlers if the stats stack can be rewritten in TS).

---

## License

TBD by the Lore-RAITE team.
