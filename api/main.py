# Local dev entrypoint only. Production hosting is the two standalone Vercel
# Python functions in api/analyze.py and api/analyze-literature.py — this file
# mounts the same _lib apps together behind one uvicorn server so `next dev`'s
# rewrite proxy (see next.config.mjs) has a single backend to talk to.
from fastapi import FastAPI, Request

from _lib.stats import analyze_data, ResearchData
from _lib.literature import analyze_literature

app = FastAPI()


@app.post("/analyze")
async def analyze(data: ResearchData):
    return await analyze_data(data)


@app.post("/analyze-literature")
async def analyze_literature_route(request: Request):
    return await analyze_literature(request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
