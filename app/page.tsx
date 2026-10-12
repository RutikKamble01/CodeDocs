"use client";

import { useState } from "react";
import JSZip from "jszip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, Download, FileArchive, FileCode2, GitBranch, LoaderCircle, Moon, Settings, Sparkles, Sun, X } from "lucide-react";

type DocumentKey = "readme" | "fileMap";
type Stage = "idle" | "fetching" | "analyzing" | "generating" | "done";

const examples = ["https://github.com/vercel/next.js", "https://github.com/shadcn-ui/ui", "https://github.com/octocat/Hello-World"];
const starterDocs = {
  readme: "# Your repository, clearly explained\n\nConnect a public GitHub repository to generate a practical README.",
  fileMap: "# FILE_MAP.md\n\nYour generated file map will appear here.",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [activeDoc, setActiveDoc] = useState<DocumentKey>("readme");
  const [view, setView] = useState<"rendered" | "raw">("rendered");
  const [stage, setStage] = useState<Stage>("idle");
  const [docs, setDocs] = useState(starterDocs);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tone, setTone] = useState("detailed");
  const [instruction, setInstruction] = useState("");
  const [copied, setCopied] = useState(false);

  const content = docs[activeDoc];
  const busy = ["fetching", "analyzing", "generating"].includes(stage);
  const label = { idle: "Ready when you are", fetching: "Fetching repository tree...", analyzing: "Analyzing tech stack & file signatures...", generating: "Generating README.md & FILE_MAP.md...", done: "Documentation generated" }[stage];

  async function generate() {
    if (!url.trim() || busy) return;
    setError("");
    try {
      setStage("fetching");
      await new Promise((resolve) => setTimeout(resolve, 300));
      setStage("analyzing");
      await new Promise((resolve) => setTimeout(resolve, 300));
      setStage("generating");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), tone, model: "gemini-3.7-flash", instruction }),
      });
      const result = await response.json() as { readme?: string; fileMap?: string; error?: string };
      if (!response.ok || !result.readme || !result.fileMap) throw new Error(result.error || "Could not generate documentation.");
      setDocs({ readme: result.readme, fileMap: result.fileMap });
      setStage("done");
    } catch (generationError) {
      setStage("idle");
      setError(generationError instanceof Error ? generationError.message : "Something went wrong.");
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
    link.download = activeDoc === "readme" ? "README.md" : "FILE_MAP.md";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function downloadZip() {
    const zip = new JSZip();
    zip.file("README.md", docs.readme);
    zip.file("FILE_MAP.md", docs.fileMap);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    link.download = "autodoc-documents.zip";
    link.click();
  }

  return (
    <main className={`${dark ? "theme-dark" : ""} grain min-h-screen`}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ink)] text-[var(--lime)]"><FileCode2 size={19} /></span><strong className="text-lg tracking-tight">AutoDoc<span className="text-[var(--coral)]">AI</span></strong></div>
        <div className="flex items-center gap-2"><button title="Toggle dark mode" onClick={() => setDark((value) => !value)} className="rounded-md p-2 text-[var(--muted)]">{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button title="Open settings" onClick={() => setSettingsOpen(true)} className="rounded-md p-2 text-[var(--muted)]"><Settings size={17} /></button></div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10 lg:pt-20">
        <div><p className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[var(--green)]"><span className="h-2 w-2 rounded-full bg-[var(--coral)]" /> Repository intelligence</p><h1 className="max-w-xl text-5xl font-black leading-[.98] tracking-[-.055em] sm:text-7xl">Make your codebase <span className="text-[var(--green)]">legible.</span></h1><p className="mt-7 max-w-md text-lg leading-8 text-[var(--muted)]">Drop in a GitHub URL. AutoDoc reads the structure, finds the story, and writes documentation your team can use.</p>
          <div className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--white)] p-2 shadow-[0_18px_50px_rgba(36,99,77,.08)]"><div className="flex flex-col gap-2 sm:flex-row"><label className="flex flex-1 items-center gap-3 px-4"><GitBranch size={19} className="text-[var(--muted)]" /><input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => event.key === "Enter" && generate()} placeholder="https://github.com/you/your-repo" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" /></label><button onClick={generate} disabled={!url.trim() || busy} className="flex items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />} {stage === "done" ? "Regenerate" : "Generate docs"}</button></div></div>
          <div className="mt-5 flex flex-wrap gap-2">{examples.map((example) => <button key={example} onClick={() => setUrl(example)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)]">{example.split("/").slice(-2).join("/")}</button>)}</div>{error && <p className="mt-4 rounded-lg bg-[#fff0eb] px-4 py-3 text-sm font-semibold text-[#bd533d]">{error}</p>}
        </div>
        <div className="rounded-2xl bg-[var(--ink)] p-4 shadow-[0_25px_70px_rgba(20,33,28,.2)]"><div className="min-h-[420px] rounded-xl bg-[#f8faf4] p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--coral)]">Generated artifact</p><h2 className="mt-2 text-2xl font-black">{activeDoc === "readme" ? "README.md" : "FILE_MAP.md"}</h2><div className="markdown-body mt-8 max-h-64 overflow-hidden text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{content}</ReactMarkdown></div><p className="mt-8 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">{label}</p></div></div>
      </section>

      <section className="border-t border-[var(--line)] bg-[var(--white)] px-6 py-10 lg:px-10"><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-widest text-[var(--coral)]">Output workspace</p><h2 className="mt-2 text-2xl font-black">Two files. One clear picture.</h2></div><div className="flex gap-2"><button onClick={copy} className="flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-xs font-bold">{copied ? <Check size={14} /> : <Copy size={14} />} Copy</button><button onClick={download} className="flex items-center gap-2 rounded-md bg-[var(--ink)] px-3 py-2 text-xs font-bold text-white"><Download size={14} /> Download</button><button onClick={downloadZip} className="flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-xs font-bold"><FileArchive size={14} /> ZIP</button></div></div><div className="mt-6 flex items-center justify-between border-b border-[var(--line)]"><div className="flex"><button onClick={() => setActiveDoc("readme")} className={`border-b-2 px-4 py-3 text-sm font-bold ${activeDoc === "readme" ? "border-[var(--coral)]" : "border-transparent text-[var(--muted)]"}`}>README.md</button><button onClick={() => setActiveDoc("fileMap")} className={`border-b-2 px-4 py-3 text-sm font-bold ${activeDoc === "fileMap" ? "border-[var(--coral)]" : "border-transparent text-[var(--muted)]"}`}>FILE_MAP.md</button></div><div className="flex gap-1 rounded-md border border-[var(--line)] p-1 text-xs"><button onClick={() => setView("rendered")} className={`rounded px-2 py-1 ${view === "rendered" ? "bg-[var(--ink)] text-white" : ""}`}>Rendered</button><button onClick={() => setView("raw")} className={`rounded px-2 py-1 ${view === "raw" ? "bg-[var(--ink)] text-white" : ""}`}>Raw</button></div></div><div className="markdown-body mt-6 min-h-64 rounded-lg border border-[var(--line)] bg-[#fbfcf8] p-6">{view === "raw" ? <textarea value={content} onChange={(event) => setDocs((current) => ({ ...current, [activeDoc]: event.target.value }))} className="min-h-64 w-full resize-y bg-transparent font-mono text-sm leading-7 outline-none" /> : <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{content}</ReactMarkdown>}</div></div></section>

      {settingsOpen && <div className="fixed inset-0 z-20 bg-[var(--ink)]/20" onClick={() => setSettingsOpen(false)}><aside className="absolute right-0 top-0 h-full w-full max-w-sm bg-[var(--white)] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-xl font-black">Generation settings</h2><button title="Close settings" onClick={() => setSettingsOpen(false)}><X size={18} /></button></div><p className="mt-8 text-sm font-bold">Model</p><p className="mt-2 rounded-md border border-[var(--line)] p-3 text-sm">Gemini 3.8 Flash</p><label className="mt-5 block text-sm font-bold">Tone<select value={tone} onChange={(event) => setTone(event.target.value)} className="mt-2 w-full rounded-md border border-[var(--line)] bg-transparent p-3 text-sm"><option value="minimal">Minimal</option><option value="detailed">Detailed</option><option value="startup">Startup</option></select></label><label className="mt-5 block text-sm font-bold">Custom instruction<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Make it beginner friendly" className="mt-2 min-h-24 w-full rounded-md border border-[var(--line)] bg-transparent p-3 text-sm" /></label></aside></div>}
    </main>
  );
}
