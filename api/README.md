# Python Backend — Stats & Lit Gap Analyzer

## Setup

```bash
cd api
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

The frontend expects the server at `http://localhost:8000`.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /analyze` | Psych stats test selection (T-test, ANOVA, Kruskal, etc.) |
| `POST /analyze-literature` | Literature gap analysis via Groq AI |

## Environment

`GROQ_API_KEY` is read from the project root `.env.local` — no extra setup needed if you already have it there.
