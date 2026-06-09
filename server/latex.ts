import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultSettings,
  getCurrentWorkspaceDirs,
  getWorkspaceDirs,
  readAppState
} from "./storage.js";
import type { Bank, CompileResult, LatexSettings, QuestionItem, TexStatus } from "../shared/types.js";

export type ExportOrderMode = "normal" | "random";

export function sanitizeFileName(input: string): string {
  const cleaned = input
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim();
  return cleaned || `export-${new Date().toISOString().slice(0, 10)}`;
}

export function selectedItems(
  bank: Bank,
  ids: string[],
  options: { orderMode?: ExportOrderMode; randomSeed?: string } = {}
): QuestionItem[] {
  const idSet = new Set(ids);
  const items = bank.items.filter((item) => idSet.has(item.id)).sort((a, b) => a.order - b.order);
  return orderItemsForExport(items, options.orderMode ?? "normal", options.randomSeed ?? "");
}

export function orderItemsForExport(
  items: QuestionItem[],
  orderMode: ExportOrderMode,
  randomSeed: string
): QuestionItem[] {
  const orderedItems = [...items].sort((a, b) => a.order - b.order);
  if (orderMode !== "random") return orderedItems;
  return shuffleWithSeed(orderedItems, randomSeed);
}

export function buildQuestionOnlyLatex(items: QuestionItem[], settings = defaultSettings): string {
  const body = items.map((item, index) => renderQuestionOnlyItem(item, index + 1, settings)).join("\n\n");
  return wrapDocument(body, settings, "questions");
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const shuffled = [...items];
  const random = mulberry32(fnv1a32(seed));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildFullLatex(items: QuestionItem[], settings = defaultSettings): string {
  const body = items.map((item, index) => renderFullItem(item, index + 1, settings)).join("\n\n");
  return wrapDocument(body, settings, "full");
}

export async function writeCurrentItemCheck(item: QuestionItem, settings: LatexSettings): Promise<string> {
  const { tempDir } = await getCurrentWorkspaceDirs();
  const workDir = path.join(tempDir, `compile-${crypto.randomUUID()}`);
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });
  await copyAssetsForItems([item], workDir);
  const texPath = path.join(workDir, "current-item.tex");
  await writeFile(texPath, buildFullLatex([item], settings), "utf8");
  return texPath;
}

export async function copyAssetsForItems(items: QuestionItem[], targetDir: string, workspacePath?: string) {
  const { assetDir } = workspacePath ? getWorkspaceDirs(workspacePath) : await getCurrentWorkspaceDirs();
  const targetAssetDir = path.join(targetDir, "assets");
  await mkdir(targetAssetDir, { recursive: true });
  const fileNames = new Set(items.flatMap((item) => item.assets.map((asset) => asset.fileName).filter(Boolean)));
  await Promise.all(
    [...fileNames].map(async (fileName) => {
      const source = path.join(assetDir, path.basename(fileName));
      const target = path.join(targetAssetDir, path.basename(fileName));
      try {
        await access(source, constants.R_OK);
        await copyFile(source, target);
      } catch {
        // Missing assets should surface as LaTeX compile errors while preserving the .tex file.
      }
    })
  );
}

export async function compileLatex(texPath: string, cwd: string, timeoutMs = 45_000): Promise<CompileResult> {
  const texFile = path.basename(texPath);
  const pdfPath = path.join(cwd, texFile.replace(/\.tex$/i, ".pdf"));
  const texStatus = await detectTexInstallation();
  const latexmkCommand = texStatus.command;
  if (!texStatus.available || !latexmkCommand) {
    return {
      ok: false,
      texPath,
      log: `${texStatus.message}\n请安装 MacTeX、TeX Live 或 MiKTeX，并确保 latexmk 与 xelatex 可在 PATH 中使用。`
    };
  }
  const args = [
    "-xelatex",
    "-interaction=nonstopmode",
    "-halt-on-error",
    "-file-line-error",
    texFile
  ];

  return new Promise((resolve) => {
    const child = spawn(latexmkCommand, args, {
      cwd,
      env: createLatexProcessEnv(latexmkCommand)
    });
    let log = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill("SIGTERM");
        settled = true;
        resolve({ ok: false, texPath, log: `${log}\nLaTeX compile timed out after ${timeoutMs}ms.` });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      log += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      log += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      resolve({ ok: false, texPath, log: `${log}\n${error.message}` });
    });
    child.on("close", async (code) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      const ok = code === 0 && (await fileExists(pdfPath));
      resolve({ ok, texPath, pdfPath: ok ? pdfPath : undefined, log: summarizeLog(log) });
    });
  });
}

export async function detectTexInstallation(): Promise<TexStatus> {
  const state = await readAppState();
  const override = state.texPathOverride ?? process.env.KMB_LATEXMK_PATH;
  const candidates: Array<{ command: string; source: TexStatus["source"] }> = [
    ...(override ? [{ command: override, source: "override" as const }] : []),
    { command: "latexmk", source: "path" },
    ...commonLatexmkPaths().map((command) => ({ command, source: "common" as const }))
  ];

  for (const candidate of candidates) {
    const result = await probeLatexmk(candidate.command);
    if (result.available) {
      return {
        available: true,
        command: candidate.command,
        source: candidate.source,
        version: result.version,
        message: `已检测到 LaTeX：${candidate.command}`
      };
    }
  }

  return {
    available: false,
    source: "missing",
    message: "未检测到 latexmk。"
  };
}

export async function listExportFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((file) => /\.(tex|pdf)$/i.test(file)).sort();
  } catch {
    return [];
  }
}

function wrapDocument(body: string, settings: LatexSettings, kind: "questions" | "full"): string {
  const preamble = [basePreamble(), settings.preamble.trim()].filter(Boolean).join("\n\n");
  const title = kind === "questions" ? "题目汇总" : "题目解析备注汇总";
  return `${preamble}

\\title{${title}}
\\date{}

\\begin{document}
\\maketitle

${body || "\\begin{center}\\small 暂无选中题目\\end{center}"}

\\end{document}
`;
}

function basePreamble(): string {
  return String.raw`\documentclass[UTF8,12pt]{ctexart}
\usepackage[a4paper,margin=2.35cm]{geometry}
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{mathtools}
\usepackage{graphicx}
\usepackage{tikz}
\usepackage{pgfplots}
\usepackage{hyperref}
\pgfplotsset{compat=1.18}
\graphicspath{{./assets/}}
\hypersetup{colorlinks=true,linkcolor=black,urlcolor=blue}
\setlength{\parindent}{2em}
\setlength{\parskip}{0.35em}
\linespread{1.12}`;
}

function renderQuestionOnlyItem(item: QuestionItem, number: number, settings: LatexSettings): string {
  const source = item.sourceNumber ? `\\hfill {\\small 原编号：${escapeLatexText(item.sourceNumber)}}` : "";
  return String.raw`\subsection*{第 ${number} 题 ${source}}
${stripDocumentCommands(item.questionTex)}

\vspace{${settings.spacing.item}}`;
}

function renderFullItem(item: QuestionItem, number: number, settings: LatexSettings): string {
  const source = item.sourceNumber ? `\\hfill {\\small 原编号：${escapeLatexText(item.sourceNumber)}}` : "";
  return String.raw`\subsection*{第 ${number} 题 ${source}}
\textbf{题目}

${stripDocumentCommands(item.questionTex)}

\vspace{${settings.spacing.module}}
\textbf{解析}

${stripDocumentCommands(item.solutionTex)}

\vspace{${settings.spacing.module}}
\textbf{备注}

${stripDocumentCommands(item.noteTex)}

\vspace{${settings.spacing.item}}`;
}

function stripDocumentCommands(input: string): string {
  return input
    .replace(/\\documentclass(?:\[[^\]]*])?\{[^}]+}/g, "")
    .replace(/\\begin\{document}/g, "")
    .replace(/\\end\{document}/g, "")
    .trim();
}

function escapeLatexText(input: string): string {
  return input.replace(/[#$%&_{}]/g, (char) => `\\${char}`).replace(/~/g, "\\textasciitilde{}").replace(/\^/g, "\\textasciicircum{}");
}

function summarizeLog(log: string): string {
  const lines = log.split(/\r?\n/);
  const important = lines.filter((line) => /(^!|error|warning|undefined|missing|fatal|LaTeX)/i.test(line));
  const summary = important.slice(-60).join("\n").trim();
  return summary || lines.slice(-80).join("\n").trim();
}

function commonLatexmkPaths(): string[] {
  if (process.platform === "darwin") {
    return [
      "/Library/TeX/texbin/latexmk",
      "/usr/local/texlive/2026/bin/universal-darwin/latexmk",
      "/usr/local/texlive/2025/bin/universal-darwin/latexmk",
      "/opt/homebrew/bin/latexmk",
      "/usr/local/bin/latexmk"
    ];
  }

  if (process.platform === "win32") {
    const years = ["2026", "2025", "2024", "2023"];
    return [
      ...years.map((year) => `C:\\texlive\\${year}\\bin\\windows\\latexmk.exe`),
      "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\latexmk.exe",
      "C:\\Program Files (x86)\\MiKTeX\\miktex\\bin\\latexmk.exe"
    ];
  }

  return ["/usr/bin/latexmk", "/usr/local/bin/latexmk"];
}

export function createLatexProcessEnv(latexmkCommand: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const pathKey = getPathEnvKey(env);
  const existingPath = env[pathKey] ?? "";
  const latexmkDir = path.basename(latexmkCommand) === latexmkCommand ? "" : path.dirname(latexmkCommand);
  const extraDirs = [
    latexmkDir,
    ...(process.platform === "darwin" ? ["/Library/TeX/texbin"] : [])
  ].filter(Boolean);
  const mergedPath = [...extraDirs, existingPath].filter(Boolean).join(path.delimiter);
  env[pathKey] = mergedPath;
  return env;
}

function getPathEnvKey(env: NodeJS.ProcessEnv): string {
  if (process.platform !== "win32") return "PATH";
  return Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "Path";
}

function probeLatexmk(command: string, timeoutMs = 3_000): Promise<{ available: boolean; version?: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, ["-version"], { env: createLatexProcessEnv(command) });
    let output = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGTERM");
        resolve({ available: false });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", () => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      resolve({ available: false });
    });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      const firstLine = output.split(/\r?\n/).find(Boolean);
      resolve({ available: code === 0, version: firstLine });
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
