import { Octokit } from "@octokit/rest";
import type { RepoFile, RepositoryContext } from "@/types";

const MAX_FILES = 1_000;
const MAX_FILE_SIZE = 100_000;
const MAX_KEY_FILES = 28;
const ignoredPath = /(^|\/)(\.git|node_modules|dist|build|\.next|venv|__pycache__)(\/|$)/i;
const ignoredFile = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock)$|\.(png|jpe?g|gif|ico|pdf|exe|zip|mp4|mov|woff2?|ttf|bin)$/i;
const keyFile = /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod|Dockerfile|docker-compose\.ya?ml|Makefile|README\.md|\.env\.example|next\.config\.(js|mjs|ts)|vite\.config\.(js|ts)|webpack\.config\.(js|ts)|app\.(js|jsx|ts|tsx)|main\.(js|jsx|ts|tsx|py|go|rs)|index\.(js|jsx|ts|tsx)|server\.(js|ts)|manage\.py)$/i;

export class GithubError extends Error {
  constructor(public readonly code: "INVALID_URL" | "NOT_FOUND" | "PRIVATE_REPOSITORY" | "EMPTY_REPOSITORY" | "RATE_LIMITED" | "TOO_LARGE", message: string) {
    super(message);
    this.name = "GithubError";
  }
}

export function parseGitHubUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new GithubError("INVALID_URL", "Enter a valid GitHub repository URL.");
  }
  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com") {
    throw new GithubError("INVALID_URL", "Use a public github.com repository URL.");
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) throw new GithubError("INVALID_URL", "Enter a complete GitHub repository URL.");
  return { owner: segments[0], repo: segments[1].replace(/\.git$/i, "") };
}

function isUsableFile(file: RepoFile) {
  return file.type === "blob" && Boolean(file.path) && !ignoredPath.test(file.path) && !ignoredFile.test(file.path);
}

async function readFile(octokit: Octokit, owner: string, repo: string, branch: string, file: RepoFile) {
  if ((file.size ?? 0) > MAX_FILE_SIZE) return null;
  const response = await octokit.repos.getContent({ owner, repo, path: file.path, ref: branch });
  const data = response.data;
  if (!Array.isArray(data) && "content" in data && data.encoding === "base64") {
    return { path: file.path, content: Buffer.from(data.content, "base64").toString("utf8").slice(0, MAX_FILE_SIZE) };
  }
  return null;
}

export async function getRepositoryContext(url: string): Promise<RepositoryContext> {
  const { owner, repo } = parseGitHubUrl(url);
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
  try {
    const repository = await octokit.repos.get({ owner, repo });
    const branch = repository.data.default_branch;
    const branchData = await octokit.repos.getBranch({ owner, repo, branch });
    const commitSha = branchData.data.commit.sha;
    const treeResponse = await octokit.git.getTree({ owner, repo, tree_sha: commitSha, recursive: "true" });
    const allFiles = (treeResponse.data.tree as RepoFile[]).filter(isUsableFile);
    if (allFiles.length === 0) throw new GithubError("EMPTY_REPOSITORY", "This repository does not contain readable source files.");
    const prioritizedFiles = allFiles.filter((file) => keyFile.test(file.path));
    const files = [...new Map([...prioritizedFiles, ...allFiles].map((file) => [file.path, file])).values()].slice(0, MAX_FILES);
    const prioritized = files.filter((file) => keyFile.test(file.path)).slice(0, MAX_KEY_FILES);
    const keyFiles = (await Promise.all(prioritized.map((file) => readFile(octokit, owner, repo, branch, file)))).filter((file): file is { path: string; content: string } => file !== null);
    return { owner, repo, branch, sha: commitSha, description: repository.data.description, tree: files.map((file) => file.path).join("\n"), files, keyFiles };
  } catch (error) {
    if (error instanceof GithubError) throw error;
    const status = (error as { status?: number }).status;
    if (status === 404) throw new GithubError("NOT_FOUND", "Repository not found. Make sure it is public and the URL is correct.");
    if (status === 403 || status === 429) throw new GithubError("RATE_LIMITED", "GitHub rate limit reached. Add a GitHub token and try again.");
    throw new GithubError("NOT_FOUND", "GitHub could not be reached for this repository.");
  }
}
