export type DocumentKey = "readme" | "fileMap";

export type RepoFile = {
  path: string;
  size?: number;
  sha: string;
  type: "blob" | "tree";
  url?: string;
};

export type RepositoryContext = {
  owner: string;
  repo: string;
  branch: string;
  sha: string;
  description: string | null;
  tree: string;
  files: RepoFile[];
  keyFiles: Array<{ path: string; content: string }>;
};

export type RepositoryAnalysis = {
  stack: string[];
  scripts: Record<string, string>;
  commands: string[];
  entryPoints: string[];
  directoryTree: string;
  redactedFiles: Array<{ path: string; content: string }>;
};

export type GeneratedDocuments = {
  readme: string;
  fileMap: string;
  commitSha?: string;
};

export type ApiErrorCode =
  | "INVALID_URL"
  | "NOT_FOUND"
  | "PRIVATE_REPOSITORY"
  | "EMPTY_REPOSITORY"
  | "RATE_LIMITED"
  | "TOO_LARGE"
  | "PROVIDER_ERROR"
  | "UNKNOWN";

export type ApiError = {
  error: string;
  code: ApiErrorCode;
};
