import { constants } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AppState,
  Bank,
  LatexSettings,
  QuestionItem,
  StarRating,
  WorkspaceSummary
} from "./types.js";

export const rootDir = path.resolve(process.env.KMB_ROOT_DIR ?? process.cwd());
export const appDataDir = path.resolve(process.env.KMB_APP_DATA_DIR ?? path.join(rootDir, ".app-data"));
export const appStatePath = path.join(appDataDir, "app-state.json");
export const defaultStarRating: StarRating = 5;

const forcedWorkspacePath = process.env.KMB_WORKSPACE_DIR
  ? path.resolve(process.env.KMB_WORKSPACE_DIR)
  : "";

export interface WorkspaceDirs {
  workspaceDir: string;
  bankPath: string;
  assetDir: string;
  exportDir: string;
  tempDir: string;
}

export const defaultSettings: LatexSettings = {
  pageSize: "a4",
  spacing: {
    item: "1.0em",
    module: "0.45em"
  },
  preamble: `% 可在这里添加全局宏命令，例如：
% \\newcommand{\\R}{\\mathbb{R}}`
};

export async function ensureProjectDirs() {
  await mkdir(appDataDir, { recursive: true });
  await readAppState();
}

export async function readAppState(): Promise<AppState> {
  await mkdir(appDataDir, { recursive: true });

  if (forcedWorkspacePath) {
    await ensureWorkspace(forcedWorkspacePath, { sample: false });
    return {
      version: 1,
      currentWorkspacePath: forcedWorkspacePath,
      recentWorkspacePaths: [forcedWorkspacePath],
      texPathOverride: safeOptionalString(process.env.KMB_LATEXMK_PATH)
    };
  }

  try {
    const raw = await readFile(appStatePath, "utf8");
    const state = normalizeAppState(JSON.parse(raw));
    const normalized = normalizeAppState(state);
    await writeAppState(normalized);
    return normalized;
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const state = normalizeAppState({
      version: 1,
      recentWorkspacePaths: []
    });
    await writeAppState(state);
    return state;
  }
}

export async function writeAppState(state: AppState): Promise<AppState> {
  await mkdir(appDataDir, { recursive: true });
  const normalized = normalizeAppState(state);
  await writeFile(appStatePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function updateTexPathOverride(texPathOverride: string | undefined): Promise<AppState> {
  const state = await readAppState();
  return writeAppState({
    ...state,
    texPathOverride: texPathOverride?.trim() || undefined
  });
}

export async function createWorkspace(name: string): Promise<AppState> {
  const root = getDefaultWorkspaceRoot();
  await mkdir(root, { recursive: true });
  const baseName = sanitizeWorkspaceName(name) || "New Bank";
  let workspacePath = path.join(root, baseName);
  let suffix = 2;
  while (await fileExists(workspacePath)) {
    workspacePath = path.join(root, `${baseName} ${suffix}`);
    suffix += 1;
  }
  await ensureWorkspace(workspacePath, { sample: false });
  return switchWorkspace(workspacePath);
}

export async function createEmptyWorkspace(workspacePath: string): Promise<AppState> {
  const resolvedPath = path.resolve(workspacePath);
  if (await workspaceExists(resolvedPath)) {
    throw new Error("该文件夹已经是题库工作区。请使用“打开”切换到它。");
  }
  await ensureWorkspace(resolvedPath, { sample: false });
  return switchWorkspace(resolvedPath);
}

export async function createSampleWorkspace(workspacePath: string): Promise<AppState> {
  const resolvedPath = path.resolve(workspacePath);
  if (await workspaceExists(resolvedPath)) {
    throw new Error("该文件夹已经是题库工作区。请选择一个新文件夹，或使用“打开”切换到它。");
  }
  await ensureWorkspace(resolvedPath, { sample: true });
  return switchWorkspace(resolvedPath);
}

export async function openExistingWorkspace(workspacePath: string): Promise<AppState> {
  const resolvedPath = path.resolve(workspacePath);
  if (!(await workspaceExists(resolvedPath))) {
    throw new Error("这个文件夹不是题库工作区：缺少 bank.json。请使用“新建”创建空工作区。");
  }
  return switchWorkspace(resolvedPath);
}

export async function switchWorkspace(workspacePath: string): Promise<AppState> {
  const resolvedPath = path.resolve(workspacePath);
  await ensureWorkspace(resolvedPath, { sample: false });
  const state = await readAppState();
  return writeAppState({
    ...state,
    currentWorkspacePath: resolvedPath,
    recentWorkspacePaths: normalizeRecent([resolvedPath, ...state.recentWorkspacePaths])
  });
}

export async function removeWorkspace(workspacePath: string): Promise<AppState> {
  const resolvedPath = path.resolve(workspacePath);
  const state = await readAppState();
  const recentWorkspacePaths = state.recentWorkspacePaths.filter((item) => item !== resolvedPath);
  const currentWorkspacePath =
    state.currentWorkspacePath === resolvedPath ? recentWorkspacePaths[0] : state.currentWorkspacePath;
  return writeAppState({
    ...state,
    currentWorkspacePath,
    recentWorkspacePaths
  });
}

export async function moveWorkspace(workspacePath: string, direction: -1 | 1): Promise<AppState> {
  const resolvedPath = path.resolve(workspacePath);
  const state = await readAppState();
  const recentWorkspacePaths = [...state.recentWorkspacePaths];
  const index = recentWorkspacePaths.indexOf(resolvedPath);
  const targetIndex = index + direction;
  if (index === -1 || targetIndex < 0 || targetIndex >= recentWorkspacePaths.length) {
    return state;
  }
  [recentWorkspacePaths[index], recentWorkspacePaths[targetIndex]] = [
    recentWorkspacePaths[targetIndex],
    recentWorkspacePaths[index]
  ];
  return writeAppState({
    ...state,
    recentWorkspacePaths
  });
}

export async function listRecentWorkspaces(): Promise<WorkspaceSummary[]> {
  const state = await readAppState();
  return Promise.all(
    state.recentWorkspacePaths.map(async (workspacePath) => ({
      name: workspaceNameFromPath(workspacePath),
      path: workspacePath,
      exists: await fileExists(path.join(workspacePath, "bank.json"))
    }))
  );
}

export async function ensureCurrentWorkspace(): Promise<WorkspaceDirs> {
  const state = await readAppState();
  if (!state.currentWorkspacePath) {
    throw new Error("尚未选择题库工作区。");
  }
  return ensureWorkspace(state.currentWorkspacePath, { sample: false });
}

export function getWorkspaceDirs(workspacePath: string): WorkspaceDirs {
  const workspaceDir = path.resolve(workspacePath);
  return {
    workspaceDir,
    bankPath: path.join(workspaceDir, "bank.json"),
    assetDir: path.join(workspaceDir, "assets"),
    exportDir: path.join(workspaceDir, "exports"),
    tempDir: path.join(workspaceDir, ".tmp")
  };
}

export async function getCurrentWorkspaceDirs(): Promise<WorkspaceDirs> {
  const state = await readAppState();
  if (!state.currentWorkspacePath) {
    throw new Error("尚未选择题库工作区。");
  }
  return getWorkspaceDirs(state.currentWorkspacePath);
}

export async function ensureWorkspace(workspacePath: string, options: { sample: boolean }): Promise<WorkspaceDirs> {
  const dirs = getWorkspaceDirs(workspacePath);
  await Promise.all([
    mkdir(dirs.workspaceDir, { recursive: true }),
    mkdir(dirs.assetDir, { recursive: true }),
    mkdir(dirs.exportDir, { recursive: true }),
    mkdir(dirs.tempDir, { recursive: true })
  ]);

  if (!(await fileExists(dirs.bankPath))) {
    const bank = options.sample ? createSampleBank() : createEmptyBank();
    await writeFile(dirs.bankPath, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  }

  return dirs;
}

export function createEmptyBank(): Bank {
  return {
    version: 1,
    settings: defaultSettings,
    items: []
  };
}

export function createSampleBank(): Bank {
  const now = "2026-01-01T00:00:00.000Z";
  const items: QuestionItem[] = [
    {
      id: "sample-limit",
      order: 1,
      sourceNumber: "自造示例 1",
      chapter: "高等数学/极限",
      tags: ["极限", "等价无穷小"],
      star: 3,
      questionTex: "求极限 $\\displaystyle \\lim_{x\\to 0}\\frac{\\sin x-x}{x^3}$。",
      solutionTex:
        "由泰勒公式 $\\sin x=x-\\dfrac{x^3}{6}+o(x^3)$，得\n\\[\n\\lim_{x\\to 0}\\frac{\\sin x-x}{x^3}=-\\frac16.\n\\]",
      noteTex: "这是一个用于演示实时公式预览和导出编译的自造例题。",
      assets: [],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "sample-linear-algebra",
      order: 2,
      sourceNumber: "自造示例 2",
      chapter: "线性代数/矩阵",
      tags: ["矩阵", "行列式"],
      star: 2,
      questionTex:
        "设 $A=\\begin{pmatrix}1&2\\\\0&3\\end{pmatrix}$，求 $\\det A$ 与 $A$ 的特征值。",
      solutionTex:
        "因为 $A$ 是上三角矩阵，所以\n\\[\n\\det A=1\\cdot 3=3,\n\\]\n特征值为主对角线元素 $1,3$。",
      noteTex: "上三角矩阵的行列式和特征值都可以直接从主对角线读取。",
      assets: [],
      createdAt: now,
      updatedAt: now
    }
  ];

  return {
    version: 1,
    settings: defaultSettings,
    items
  };
}

export async function readBank(): Promise<Bank> {
  const state = await readAppState();
  if (!state.currentWorkspacePath) {
    return createEmptyBank();
  }
  const dirs = getWorkspaceDirs(state.currentWorkspacePath);
  try {
    const raw = await readFile(dirs.bankPath, "utf8");
    return normalizeBank(JSON.parse(raw));
  } catch (error) {
    if (isNotFound(error)) return createEmptyBank();
    throw error;
  }
}

export async function writeBank(bank: Bank): Promise<Bank> {
  const state = await readAppState();
  if (!state.currentWorkspacePath) {
    throw new Error("尚未选择题库工作区。");
  }
  const dirs = await ensureWorkspace(state.currentWorkspacePath, { sample: false });
  const normalized = normalizeBank(bank);
  await writeFile(dirs.bankPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export function workspaceNameFromPath(workspacePath: string): string {
  return path.basename(path.resolve(workspacePath)) || "Untitled Bank";
}

export function getDefaultWorkspaceRoot(): string {
  return path.join(os.homedir(), "Documents", "Kaoyan Math Bank");
}

export function getDefaultSampleWorkspacePath(): string {
  return path.join(getDefaultWorkspaceRoot(), "Sample Bank");
}

function normalizeAppState(input: unknown): AppState {
  const candidate = input as Partial<AppState>;
  const currentWorkspacePath = safeOptionalString(candidate.currentWorkspacePath);
  const recentWorkspacePaths = candidate.recentWorkspacePaths ?? [];
  const normalizedCurrentWorkspacePath = currentWorkspacePath ? path.resolve(currentWorkspacePath) : undefined;
  const hasCurrentInRecent =
    normalizedCurrentWorkspacePath &&
    recentWorkspacePaths.some(
      (workspacePath) =>
        typeof workspacePath === "string" && path.resolve(workspacePath) === normalizedCurrentWorkspacePath
    );
  return {
    version: 1,
    currentWorkspacePath: normalizedCurrentWorkspacePath,
    recentWorkspacePaths: normalizeRecent(
      normalizedCurrentWorkspacePath && !hasCurrentInRecent
        ? [normalizedCurrentWorkspacePath, ...recentWorkspacePaths]
        : recentWorkspacePaths
    ),
    texPathOverride: safeOptionalString(candidate.texPathOverride)
  };
}

function normalizeRecent(paths: unknown[]): string[] {
  const seen = new Set<string>();
  const recent: string[] = [];
  for (const item of paths) {
    if (typeof item !== "string" || !item.trim()) continue;
    const resolved = path.resolve(item);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    recent.push(resolved);
  }
  return recent.slice(0, 10);
}

function normalizeBank(input: unknown): Bank {
  const candidate = input as Partial<Bank>;
  const settings = normalizeSettings(candidate.settings);
  const items = Array.isArray(candidate.items) ? candidate.items.map(normalizeItem) : [];
  return {
    version: 1,
    settings,
    items: items
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({ ...item, order: index + 1 }))
  };
}

function normalizeSettings(input: unknown): LatexSettings {
  const candidate = input as Partial<LatexSettings>;
  return {
    pageSize: "a4",
    spacing: {
      item: safeString(candidate?.spacing?.item, defaultSettings.spacing.item),
      module: safeString(candidate?.spacing?.module, defaultSettings.spacing.module)
    },
    preamble: safeString(candidate?.preamble, defaultSettings.preamble)
  };
}

function normalizeItem(input: unknown, index: number): QuestionItem {
  const candidate = input as Partial<QuestionItem>;
  const now = new Date().toISOString();
  return {
    id: safeString(candidate.id, crypto.randomUUID()),
    order: Number.isFinite(candidate.order) ? Number(candidate.order) : index + 1,
    sourceNumber: safeOptionalString(candidate.sourceNumber),
    chapter: safeString(candidate.chapter, ""),
    tags: Array.isArray(candidate.tags)
      ? candidate.tags.map((tag) => safeString(tag, "")).filter(Boolean)
      : [],
    star: safeStarRating(candidate.star),
    questionTex: safeString(candidate.questionTex, ""),
    solutionTex: safeString(candidate.solutionTex, ""),
    noteTex: safeString(candidate.noteTex, ""),
    assets: Array.isArray(candidate.assets)
      ? candidate.assets.map((asset) => ({
          id: safeString(asset.id, crypto.randomUUID()),
          fileName: safeString(asset.fileName, ""),
          originalName: safeString(asset.originalName, ""),
          relativePath: safeString(asset.relativePath, ""),
          mimeType: safeString(asset.mimeType, ""),
          size: Number.isFinite(asset.size) ? Number(asset.size) : 0,
          uploadedAt: safeString(asset.uploadedAt, now)
        }))
      : [],
    createdAt: safeString(candidate.createdAt, now),
    updatedAt: safeString(candidate.updatedAt, now)
  };
}

function sanitizeWorkspaceName(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function safeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeStarRating(value: unknown): StarRating {
  const rating = Number(value);
  return rating >= 1 && rating <= 5 && Number.isInteger(rating) ? (rating as StarRating) : defaultStarRating;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export async function workspaceExists(workspacePath: string): Promise<boolean> {
  try {
    const result = await stat(path.join(workspacePath, "bank.json"));
    return result.isFile();
  } catch {
    return false;
  }
}
