import os
import json
import urllib.request as _urlreq
import urllib.error as _urlerr

import fitz  # PyMuPDF
from fastapi import FastAPI, UploadFile, Request
from dotenv import load_dotenv

# Load env variables from Next.js .env.local (local dev only — on Vercel these
# come from the platform's env vars instead, load_dotenv is a no-op there).
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"))

HF_API_TOKEN = os.getenv("HF_API_TOKEN")
HF_MODEL = "meta-llama/Llama-3.3-70B-Instruct"
HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions"


def extract_text_from_file(file: UploadFile) -> str:
    content = file.file.read()
    file.file.seek(0)

    if file.filename.lower().endswith(".pdf"):
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            text = ""
            for page in doc[:25]:  # limit to 25 pages
                text += page.get_text() + "\n"
            return text
        except Exception as e:
            return f"[Error parsing PDF: {e}]"
    else:
        return content.decode("utf-8", errors="ignore")


def fetch_doi_metadata(doi: str) -> str:
    doi = doi.strip()
    if not doi: return ""
    doi_clean = doi.replace("https://doi.org/", "").replace("http://doi.org/", "")
    url = f"https://api.openalex.org/works/https://doi.org/{doi_clean}"
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={'User-Agent': 'Buddy-Research-App'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            title = data.get("title", "Unknown Title")

            abstract_idx = data.get("abstract_inverted_index", {})
            abstract = "Abstract not available in OpenAlex."
            if abstract_idx:
                word_positions = []
                for word, positions in abstract_idx.items():
                    for pos in positions:
                        word_positions.append((pos, word))
                word_positions.sort(key=lambda x: x[0])
                abstract = " ".join([w[1] for w in word_positions])

            return f"Title: {title}\nAbstract: {abstract}"
    except Exception as e:
        return f"[Failed to fetch DOI metadata for {doi}: {str(e)}]"


async def analyze_literature(request: Request):
    try:
        form_data = await request.form()
    except Exception as e:
        return {"error": f"Failed to parse form: {str(e)}"}

    draft = form_data.get("draft")

    draft_text = ""
    if draft and hasattr(draft, "filename") and getattr(draft, "filename"):
        draft_text = extract_text_from_file(draft)

    reference_dois = str(form_data.get("reference_dois", ""))
    references = form_data.getlist("references")

    if not HF_API_TOKEN:
        return {"error": "HF_API_TOKEN is missing in the backend environment."}

    refs_combined = ""
    count = 1

    if references:
        for ref in references:
            if hasattr(ref, "filename") and getattr(ref, "filename"):
                ref_text = extract_text_from_file(ref)
                refs_combined += f"\n--- Reference {count} (File: {ref.filename}) ---\n{ref_text[:8000]}\n"
                count += 1

    dois = [d.strip() for d in reference_dois.replace(",", "\n").split("\n") if d.strip()]
    for doi in dois:
        metadata = fetch_doi_metadata(doi)
        refs_combined += f"\n--- Reference {count} (DOI: {doi}) ---\n{metadata}\n"
        count += 1

    if count == 1:
        return {"error": "No references or DOIs were provided. Please provide at least one reference to analyze gaps."}

    if draft_text:
        system_prompt = """
        You are an expert academic peer reviewer and literature gap analyzer.
        The user has provided their own working Draft Paper, along with a batch of Reference Papers from the field.

        Your goal is to carefully analyze the Reference literature to identify the prevailing research trends and discover the *Missing Gaps* in the field.
        Then, evaluate the user's Draft Paper to see how well it addresses those gaps.

        You MUST return a raw JSON object strictly adhering to this schema (do not use markdown formatting outside the values, return raw parsable stringified JSON):
        {
          "established_gaps": ["Gap 1 description", "Gap 2 description"],
          "draft_evaluation": {
            "strengths": ["Strength 1...", "Strength 2..."],
            "weaknesses": ["Weakness 1...", "Weakness 2..."],
            "gaps_filled": ["Specific gap successfully tackled by the draft..."]
          },
          "suggestions": ["Actionable suggestion 1", "Actionable suggestion 2"]
        }
        """

        user_prompt = f"""
        --- DRAFT PAPER ---
        {draft_text[:20000]}

        --- REFERENCE PAPERS ---
        {refs_combined}
        """
    else:
        system_prompt = """
        You are an expert academic literature analyzer.
        The user has provided a batch of Reference Papers from a given field. (No draft paper was provided).

        Your goal is to carefully analyze this collection of literature to identify prevailing research trends, discover *Missing Gaps*, and highlight unexplored angles or unanswered questions that the user could potentially research themselves.

        You MUST return a raw JSON object strictly adhering to this schema (do not use markdown formatting outside the values, return raw parsable stringified JSON):
        {
          "established_gaps": ["Gap 1 description", "Gap 2 description"],
          "unexplored_angles": ["Angle 1 description...", "Angle 2 description..."],
          "suggestions": ["Actionable research direction 1", "Actionable research direction 2"]
        }
        """

        user_prompt = f"""
        --- REFERENCE PAPERS ---
        {refs_combined}
        """

    try:
        payload = json.dumps({
            "model": HF_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 2048,
            "response_format": {"type": "json_object"},
        }).encode("utf-8")

        req = _urlreq.Request(
            HF_ROUTER_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer {HF_API_TOKEN}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with _urlreq.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        result_content = data["choices"][0]["message"]["content"]

        cleaned = result_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 2)[1]
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip().rstrip("`").strip()

        return json.loads(cleaned)
    except _urlerr.HTTPError as e:
        return {"error": f"Hugging Face request failed ({e.code}): {e.read().decode('utf-8', errors='ignore')[:500]}"}
    except Exception as e:
        return {"error": f"Hugging Face request failed: {str(e)}"}


def create_app() -> FastAPI:
    app = FastAPI()

    # Catch-all: this file is bound 1:1 to a single Vercel route
    # (/api/analyze-literature), so any path the platform forwards here —
    # "/" or the full original path — resolves to the same handler.
    @app.post("/{full_path:path}")
    async def analyze(request: Request):
        return await analyze_literature(request)

    return app
