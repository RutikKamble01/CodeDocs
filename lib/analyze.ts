import type { RepoFile, RepositoryAnalysis, RepositoryContext } from "@/types";

const MAX_FILE_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 48_000;

const secretPatterns = [
  /((?:api[_-]?key|secret|token|password|private[_-]?key)\s*[=:]\s*["']?)[^\s"']+/gi,
  /(sk-[A-Za-z0-9_-]{16,})/g,
  /(gh[pousr]_[A-Za-z0-9_]{20,})/g,
  /(AIza[A-Za-z0-9_-]{20,})/g,
];

const entryPointPattern = /(^|\/)(app\.(js|jsx|ts|tsx)|main\.(js|jsx|ts|tsx|py|go|rs)|index\.(js|jsx|ts|tsx)|server\.(js|ts)|manage\.py|Dockerfile|Makefile)$/i;

function redactSecrets(content: string) {
  return secretPatterns.reduce((result, pattern) => result.replace(pattern, "$1[REDACTED]"), content);
}

function detectFromFile(path: string, content: string, stack: Set<string>, scripts: Record<string, string>) {
  const lowerPath = path.toLowerCase();
  if (lowerPath === "package.json") {
    try {
      const packageJson = JSON.parse(content) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).forEach((dependency) => stack.add(dependency));
      Object.assign(scripts, packageJson.scripts ?? {});
    } catch {
      stack.add("JavaScript / TypeScript");
    }
  }
  if (lowerPath.endsWith("requirements.txt") || lowerPath.endsWith("pyproject.toml")) stack.add("Python");
  if (lowerPath.endsWith("cargo.toml")) stack.add("Rust");
  if (lowerPath.endsWith("go.mod")) stack.add("Go");
  if (lowerPath.endsWith("dockerfile") || lowerPath.includes("docker-compose")) stack.add("Docker");
  if (lowerPath.endsWith("next.config.ts") || lowerPath.endsWith("next.config.js")) stack.add("Next.js");
  if (lowerPath.endsWith("vite.config.ts") || lowerPath.endsWith("vite.config.js")) stack.add("Vite");
}

function rankFile(file: RepoFile) {
  const path = file.path.toLowerCase();
  if (/package\.json|pyproject\.toml|requirements\.txt|cargo\.toml|go\.mod|dockerfile|makefile/.test(path)) return 0;
  if (entryPointPattern.test(file.path)) return 1;
  if (/readme|\.env\.example|config|schema|routes?|api/.test(path)) return 2;
  return 3;
}

export function buildDirectoryTree(files: RepoFile[]) {
  return files.map((file) => file.path).sort((a, b) => a.localeCompare(b)).join("\n");
}

export function analyzeRepository(context: RepositoryContext): RepositoryAnalysis {
  const stack = new Set<string>();
  const scripts: Record<string, string> = {};
  const rankedFiles = [...context.files].sort((a, b) => rankFile(a) - rankFile(b));
  const selected = context.keyFiles.length > 0 ? context.keyFiles : [];
  let contextSize = 0;
  const redactedFiles = selected.flatMap(({ path, content }) => {
    if (contextSize >= MAX_CONTEXT_CHARS) return [];
    const safeContent = redactSecrets(content).slice(0, Math.min(MAX_FILE_CHARS, MAX_CONTEXT_CHARS - contextSize));
    contextSize += safeContent.length;
    return [{ path, content: safeContent }];
  });

  redactedFiles.forEach(({ path, content }) => detectFromFile(path, content, stack, scripts));
  const entryPoints = rankedFiles.filter((file) => entryPointPattern.test(file.path)).slice(0, 20).map((file) => file.path);
  const commands = [scripts.dev, scripts.start, scripts.build, scripts.test].filter((command): command is string => Boolean(command));

  return {
    stack: [...stack].sort(),
    scripts,
    commands,
    entryPoints,
    directoryTree: buildDirectoryTree(context.files),
    redactedFiles,
  };
}
