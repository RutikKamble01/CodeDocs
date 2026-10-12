import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import type { RepositoryAnalysis, RepositoryContext } from "@/types";

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

export type GenerationOptions = {
  tone?: "minimal" | "detailed" | "startup";
  model?: "gemini-3.7-flash";
  instruction?: string;
};

export async function generateDocumentation(context: RepositoryContext, analysis: RepositoryAnalysis, options: GenerationOptions = {}) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Add GEMINI_API_KEY to .env.local to generate documentation.");
  const keyFiles = analysis.redactedFiles.map(({ path, content }) => `${path}:\n${content}`).join("\n\n");
  const prompt = `You are a senior developer documenting the public GitHub repository ${context.owner}/${context.repo}.\nDescription: ${context.description || "No description provided."}\nTone: ${options.tone || "detailed"}\nCustom instruction: ${options.instruction || "None"}\n\nVerified stack: ${analysis.stack.join(", ") || "Unknown"}\nVerified scripts: ${JSON.stringify(analysis.scripts)}\nVerified commands: ${analysis.commands.join(", ") || "Unknown"}\nEntry points: ${analysis.entryPoints.join(", ") || "Unknown"}\n\nDirectory tree:\n${analysis.directoryTree}\n\nKey files (secrets redacted):\n${keyFiles}\n\nReturn exactly two markdown documents separated by the marker ---FILE_MAP---. First write a polished README.md with title, tagline, capabilities, verified tech stack, installation, usage, environment variables, and a Mermaid architecture diagram. Then write FILE_MAP.md with the verified tree and a concise file responsibility matrix. Ground every claim in the supplied context and say when something is unknown.`;
  const result = await generateText({ model: google(options.model || "gemini-3.7-flash"), prompt, temperature: 0.2 });
  const [readme, fileMap] = result.text.split("---FILE_MAP---");
  return { readme: readme.trim(), fileMap: (fileMap || "# FILE_MAP.md\n\nNo file map was returned.").trim() };
}