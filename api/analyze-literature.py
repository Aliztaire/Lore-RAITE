# Vercel Python Function — deployed at /api/analyze-literature
# Literature gap analysis (draft + reference PDFs/DOIs -> AI-identified gaps)
from _lib.literature import create_app

app = create_app()
