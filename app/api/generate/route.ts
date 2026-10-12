import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeRepository } from "@/lib/analyze";
import { generateDocumentation } from "@/lib/ai";
import { getCachedDocuments, setCachedDocuments } from "@/lib/cache";
import { GithubError, getRepositoryContext } from "@/lib/github";
import { checkRateLimit } from "@/lib/ratelimit";

type ErrorResponse = { error: string; code: string };
const requestSchema = z.object({
  url: z.string().trim().url().max(500),
  tone: z.enum(["minimal", "detailed", "startup"]).optional(),
  model: z.literal("gemini-3.7-flash").optional(),
  instruction: z.string().trim().max(1_000).optional(),
});

export async function POST(request: Request) {
  try {
    const identifier = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const limit = checkRateLimit(identifier);
    if (!limit.allowed) return NextResponse.json<ErrorResponse>({ error: `Too many requests. Try again in ${limit.retryAfter} seconds.`, code: "RATE_LIMITED" }, { status: 429 });
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json<ErrorResponse>({ error: "Enter a valid GitHub repository URL.", code: "INVALID_URL" }, { status: 400 });
    const context = await getRepositoryContext(parsed.data.url);
    const cacheKey = `${context.owner}/${context.repo}@${context.sha}`;
    const cached = getCachedDocuments(cacheKey);
    if (cached) return NextResponse.json(cached);
    const analysis = analyzeRepository(context);
    const documents = await generateDocumentation(context, analysis, parsed.data);
    const response = { ...documents, commitSha: context.sha };
    setCachedDocuments(cacheKey, response);
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof GithubError) {
      const status = error.code === "RATE_LIMITED" ? 429 : error.code === "INVALID_URL" ? 400 : error.code === "NOT_FOUND" ? 404 : 422;
      return NextResponse.json<ErrorResponse>({ error: error.message, code: error.code }, { status });
    }
    const message = error instanceof Error ? error.message : "Unable to process this repository.";
    return NextResponse.json<ErrorResponse>({ error: message, code: "PROVIDER_ERROR" }, { status: 502 });
  }
}
