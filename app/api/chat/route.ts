import {
  consumeStream,
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
  tool,
} from "ai";
import { hfModel } from "@/lib/hf";
import { z } from "zod";
import axios from "axios";

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are Buddy, an AI research assistant specialized in academic writing and literature reviews. Your primary goal is to help researchers conduct a Review of Related Literature (RRL).

When a researcher asks for literature, sources, or citations:
1. **Search**: Use the 'search_scholarly_articles' tool to find relevant, recent publications.
2. **Synthesize**: Don't just list the results. Group them by themes, methodologies, or findings.
3. **Cite**: Always include the authors and year for every source you mention in-text (e.g. Smith et al., 2020).
4. **Format**: Produce a structured RRL section with clear headings and critical analysis of how the sources relate to each other.

If the user has provided a project title or section context, tailor your search and synthesis to that specific research area.

COGNITIVE LOAD REDUCTION (FORMATTING RULES):
1. Extreme Brevity: Remove all fluff and robotic pleasantries (e.g., "Certainly!", "Here is what I found").
2. Bottom Line Up Front (BLUF): State the most critical action item or finding in the very first sentence.
3. Aggressive Chunking: Break complex concepts into maximum 3-5 bullet points. Limit paragraphs to 2 sentences.
4. Maximum White Space: Always leave a blank empty line between paragraphs, headings, and lists.
5. Emphasis: Use **bold** text strategically to draw the eye to the most important keywords or phrases.
6. Plain Headings: Write headings in ALL CAPS followed by a colon (e.g. "**FINDINGS:**") and a blank line.
7. Plain Lists: Use simple dashes (-) or numbers (1., 2.) for lists.

Be academic, precise, and encouraging.`;

function mockStreamResponse() {
  const text =
    "**NOTE:** AI backend bypassed (no HF_API_TOKEN set). Set HF_API_TOKEN in .env.local to enable real responses.\n\nThis is a mock reply so the UI remains functional.";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < text.length; i += 20) {
        controller.enqueue(encoder.encode(text.slice(i, i + 20)));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  if (!process.env.HF_API_TOKEN) {
    return mockStreamResponse();
  }
  const {
    messages,
    context,
  }: {
    messages: UIMessage[];
    context?: {
      projectTitle?: string;
      projectTopic?: string;
      currentSection?: string;
      sectionContent?: string;
      fullPaper?: { title: string; content: string }[];
    };
  } = await req.json();

  let systemPrompt = SYSTEM_PROMPT;
  if (context?.projectTitle) {
    systemPrompt += `\n\nCurrent Research Project: "${context.projectTitle}"`;
  }
  if (context?.projectTopic) {
    systemPrompt += `\nTopic/Abstract: ${context.projectTopic}`;
  }
  if (context?.currentSection) {
    systemPrompt += `\nCurrent Section: ${context.currentSection}`;
  }
  if (context?.fullPaper && context.fullPaper.length > 0) {
    const sectionLines = context.fullPaper.map(
      (s) => `### ${s.title.toUpperCase()}\n${s.content || "(empty)"}`
    );
    const fullText = sectionLines.join("\n\n");
    systemPrompt += `\n\nFull paper content:\n\n${fullText.substring(0, 8000)}${fullText.length > 8000 ? "\n\n[...truncated]" : ""}`;
  } else if (context?.sectionContent) {
    systemPrompt += `\nSection Content Preview: ${context.sectionContent.substring(0, 1000)}`;
  }

  // Normalize messages — ensure every message has a `parts` array (AI SDK v6 requirement)
  const normalizedUIMessages = (messages || []).map((m: any) => {
    if (!m.parts && typeof m.content === "string") {
      return { ...m, parts: [{ type: "text", text: m.content }] };
    }
    return m;
  });

  const modelMessages = await convertToModelMessages(normalizedUIMessages);

  const sanitizedMessages = (modelMessages || []).map((m: any) => {
    if (m.role === "assistant" && Array.isArray(m.toolCalls)) {
      return {
        ...m,
        toolCalls: m.toolCalls.map((tc: any) => ({
          ...tc,
          args: tc.args ?? {},
        })),
      };
    }
    return m;
  });

  try {
    const result = await streamText({
      model: hfModel(),
      system: systemPrompt,
      messages: sanitizedMessages,
      stopWhen: stepCountIs(5),
      tools: {
        search_scholarly_articles: tool({
          description:
            "Search the OpenAlex database for scholarly articles and research papers. Use this whenever the user asks for references, citations, literature, or evidence.",
          inputSchema: z.object({
            query: z
              .string()
              .describe(
                "Specific search keywords or topic for the literature search. Must not be empty.",
              ),
            limit: z.number().optional().describe("Number of results (max 8)."),
            fields: z.any().optional(),
          }),
          execute: async (args: any) => {
            const query: string =
              (typeof args?.query === "string" && args.query.trim()) ||
              context?.projectTitle ||
              "academic research";
            const limit: number = Math.min(args?.limit || 5, 8);

            console.log(`[OpenAlex] Searching: "${query}" limit=${limit}`);

            try {
              const response = await axios.get(
                "https://api.openalex.org/works",
                {
                  params: {
                    search: query,
                    per_page: limit,
                  },
                  headers: { "User-Agent": "Buddy-Research-App" },
                  timeout: 15000,
                },
              );

              const works = response.data?.results;
              if (!Array.isArray(works)) {
                return { error: "Unexpected response from OpenAlex." };
              }

              return works.map((work: any) => {
                let abstract = "";
                if (work.abstract_inverted_index) {
                  try {
                    const indexMap: Record<string, number[]> =
                      work.abstract_inverted_index;
                    const wordPositions: [string, number][] = [];
                    for (const [word, positions] of Object.entries(indexMap)) {
                      for (const pos of positions as number[]) {
                        wordPositions.push([word, pos]);
                      }
                    }
                    wordPositions.sort((a, b) => a[1] - b[1]);
                    abstract = wordPositions
                      .map((wp) => wp[0])
                      .join(" ")
                      .substring(0, 300);
                    if (abstract.length === 300) abstract += "…";
                  } catch {
                    abstract = "";
                  }
                }

                return {
                  id: work.id ?? "",
                  title: work.title ?? "Untitled",
                  authors: (work.authorships ?? []).map(
                    (a: any) => a?.author?.display_name ?? "Unknown",
                  ),
                  year: work.publication_year ?? null,
                  journal: work.primary_location?.source?.display_name ?? null,
                  volume: work.biblio?.volume ?? null,
                  issue: work.biblio?.issue ?? null,
                  first_page: work.biblio?.first_page ?? null,
                  last_page: work.biblio?.last_page ?? null,
                  doi: work.doi ?? null,
                  abstract,
                  cited_by: work.cited_by_count ?? 0,
                };
              });
            } catch (err: any) {
              console.error("[OpenAlex] Error:", err.message);
              return {
                error: "Failed to fetch articles. Please try a different query.",
              };
            }
          },
        }),
      } as any,
      abortSignal: req.signal,
    } as any);

    const streamResult = result as any;

    if (typeof streamResult.toDataStreamResponse === "function") {
      return streamResult.toDataStreamResponse();
    }
    if (typeof streamResult.toUIMessageStreamResponse === "function") {
      return streamResult.toUIMessageStreamResponse({
        originalMessages: messages,
        consumeSseStream: consumeStream,
      });
    }
    if (typeof streamResult.toTextStreamResponse === "function") {
      return streamResult.toTextStreamResponse();
    }

    throw new Error("No compatible streaming method found in AI SDK.");
  } catch (error: any) {
    console.error("[API Chat] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
