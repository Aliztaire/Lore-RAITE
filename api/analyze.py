# Vercel Python Function — deployed at /api/analyze
# Psych stats test selection (T-test, ANOVA, Kruskal-Wallis, correlation, etc.)
from _lib.stats import create_app

app = create_app()
