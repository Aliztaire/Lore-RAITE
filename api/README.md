# Python Backend — Stats & Lit Gap Analyzer

## Structure

- `_lib/stats.py`, `_lib/literature.py` — the actual logic (cleaning, test selection, PDF
  extraction, the Hugging Face call). Both export `create_app()` returning a tiny FastAPI app.
- `analyze.py`, `analyze-literature.py` — **production entrypoints**, one per file, each
  just calling `create_app()` from the matching `_lib` module. These are what Vercel
  deploys as separate Python Serverless Functions, bound 1:1 to `/api/analyze` and
  `/api/analyze-literature`.
- `main.py` — **local dev only**. Mounts both `_lib` modules under one `uvicorn` server on
  `:8000` so you only need one process running locally.

## Local dev

```bash
cd api
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The Next.js dev server (`npm run dev`) rewrites `/api/analyze` and
`/api/analyze-literature` to `http://localhost:8000/...` automatically (see
`next.config.mjs`) — the frontend always calls the relative path, never `localhost:8000`
directly, so this is the only place the port number is wired up.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/analyze` | Psych stats test selection (T-test, ANOVA, Kruskal, etc.) |
| `POST /api/analyze-literature` | Literature gap analysis via the Hugging Face router |

(Locally these are served at `/analyze` and `/analyze-literature` on `:8000` by `main.py`
— the `/api` prefix is added by the Next.js rewrite, not by the backend itself.)

## Environment

`HF_API_TOKEN` is read from the project root `.env.local` — no extra setup needed if you
already have it there. Calls the Hugging Face router directly via stdlib `urllib`
(`https://router.huggingface.co/v1/chat/completions`, `meta-llama/Llama-3.3-70B-Instruct`)
— no SDK dependency.

## Production (Vercel)

`analyze.py` and `analyze-literature.py` deploy as standalone Vercel Python Functions
alongside the Next.js app in the same project — no separate hosting, no CORS, no backend
URL to configure. See the root `README.md`'s "Deployment" section for the size-limit
caveat and fallback plan.
