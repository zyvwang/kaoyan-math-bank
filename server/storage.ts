import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AppState,
  Bank,
  BankSnapshot,
  RecoveryCandidate,
  SaveBankRequest,
  WorkspaceSummary
} from "../shared/types.js";
import { validateBankPayload } from "../shared/validation.js";
import {
  appDataDir,
  appStatePath,
  normalizeRecent,
  readPersistedAppState,
  rootDir,
  updateAppState,
  updateTexPathOverride,
  writeAppState
} from "./app-state.js";
import { writeJsonFileAtomic } from "./json-file.js";
import {
  createEmptyBank,
  createSampleBank,
  defaultSettings,
  defaultStarRating,
  moduleKinds,
  normalizeBank
} from "./bank-schema.js";

export {
  appDataDir,
  appStatePath,
  rootDir,
  updateAppState,
  updateTexPathOverride,
  writeAppState,
  writeJsonFileAtomic,
  createEmptyBank,
  createSampleBank,
  defaultSettings,
  defaultStarRating,
  moduleKinds,
  normalizeBank
};

const forcedWorkspacePath = process.env.KMB_WORKSPACE_DIR
  ? path.resolve(process.env.KMB_WORKSPACE_DIR)
  : "";

export interface WorkspaceDirs {
  workspaceDir: string;
  bankPath: string;
  assetDir: string;
  exportDir: string;
  tempDir: string;
  historyDir: string;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

const workspaceWriteQueues = new Map<string, Promise<unknown>>();
const historyCreatedForWorkspace = new Set<string>();

export async function ensureProjectDirs() {
  await mkdir(appDataDir, { recursive: true });
  if (!forcedWorkspacePath && !(await fileExists(appStatePath))) {
    await writeAppState({ version: 1, recentWorkspacePaths: [] });
  }
  const state = await readAppState();
  if (state.currentWorkspacePath && (await workspaceExists(state.currentWorkspacePath))) {
    await cleanupOldTempDirs(state.currentWorkspacePath);
  }
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

  return readPersistedAppState();
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
  if (!(await workspaceExists(resolvedPath))) {
    throw new StorageError(
      "这个文件夹不是题库工作区：缺少 bank.json。请使用“新建”创建空工作区。",
      "WORKSPACE_MISSING"
    );
  }
  return updateAppState((state) => ({
    ...state,
    currentWorkspacePath: resolvedPath,
    recentWorkspacePaths: normalizeRecent([resolvedPath, ...state.recentWorkspacePaths])
  }));
}

export async function removeWorkspace(workspacePath: string): Promise<AppState> {
  const resolvedPath = path.resolve(workspacePath);
  return updateAppState(async (state) => {
    const recentWorkspacePaths = state.recentWorkspacePaths.filter((item) => item !== resolvedPath);
    let currentWorkspacePath = state.currentWorkspacePath;
    if (state.currentWorkspacePath === resolvedPath) {
      const existence = await Promise.all(
        recentWorkspacePaths.map(async (candidate) => ({
          candidate,
          exists: await workspaceExists(candidate)
        }))
      );
      currentWorkspacePath = existence.find((entry) => entry.exists)?.candidate;
    }
    return {
      ...state,
      currentWorkspacePath,
      recentWorkspacePaths
    };
  });
}

export async function moveWorkspace(workspacePath: string, direction: -1 | 1): Promise<AppState> {
  const resolvedPath = path.resolve(workspacePath);
  return updateAppState((state) => {
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
    return {
      ...state,
      recentWorkspacePaths
    };
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

export function getWorkspaceDirs(workspacePath: string): WorkspaceDirs {
  const workspaceDir = path.resolve(workspacePath);
  return {
    workspaceDir,
    bankPath: path.join(workspaceDir, "bank.json"),
    assetDir: path.join(workspaceDir, "assets"),
    exportDir: path.join(workspaceDir, "exports"),
    tempDir: path.join(workspaceDir, ".tmp"),
    historyDir: path.join(workspaceDir, ".history")
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
    historyCreatedForWorkspace.delete(dirs.workspaceDir);
    const bank = options.sample ? createSampleBank() : createEmptyBank();
    await writeJsonFileAtomic(dirs.bankPath, bank, { backup: false });
  }

  return dirs;
}

export async function readBank(): Promise<Bank> {
  return (await readBankSnapshot()).bank;
}

export async function readBankSnapshot(): Promise<BankSnapshot> {
  const state = await readAppState();
  if (!state.currentWorkspacePath) {
    const bank = createEmptyBank();
    return { workspacePath: "", revision: revisionForContent(serializeJson(bank)), bank };
  }
  const dirs = getWorkspaceDirs(state.currentWorkspacePath);
  try {
    const raw = await readFile(dirs.bankPath, "utf8");
    return {
      workspacePath: dirs.workspaceDir,
      revision: revisionForContent(raw),
      bank: parseStoredBank(raw)
    };
  } catch (error) {
    if (isNotFound(error)) {
      throw new StorageError("当前工作区缺少 bank.json。", "WORKSPACE_MISSING", 404);
    }
    throw error;
  }
}

export async function saveBankSnapshot(request: SaveBankRequest): Promise<BankSnapshot> {
  const workspacePath = path.resolve(request.workspacePath);
  return withWorkspaceWriteLock(workspacePath, async () => {
    const state = await readAppState();
    if (!state.currentWorkspacePath || path.resolve(state.currentWorkspacePath) !== workspacePath) {
      throw new StorageError("题库保存目标已不是当前工作区，请重试。", "WORKSPACE_CHANGED", 409);
    }
    if (!(await workspaceExists(workspacePath))) {
      throw new StorageError("当前工作区缺少 bank.json。", "WORKSPACE_MISSING", 404);
    }

    const dirs = getWorkspaceDirs(workspacePath);
    const currentRaw = await readFile(dirs.bankPath, "utf8");
    const currentRevision = revisionForContent(currentRaw);
    if (currentRevision !== request.baseRevision) {
      throw new StorageError(
        "题库已被其他程序修改。当前编辑内容尚未覆盖磁盘文件。",
        "BANK_CONFLICT",
        409
      );
    }

    const bank = requireValidBank(request.bank);
    if (!historyCreatedForWorkspace.has(workspacePath)) {
      await createHistorySnapshot(dirs, currentRaw, currentRevision);
      historyCreatedForWorkspace.add(workspacePath);
    }
    await writeJsonFileAtomic(dirs.bankPath, bank);
    const raw = serializeJson(bank);
    return {
      workspacePath,
      revision: revisionForContent(raw),
      bank
    };
  });
}

export async function listRecoveryCandidates(): Promise<RecoveryCandidate[]> {
  const dirs = await getCurrentWorkspaceDirs();
  return listRecoveryCandidatesForDirs(dirs);
}

async function listRecoveryCandidatesForDirs(dirs: WorkspaceDirs): Promise<RecoveryCandidate[]> {
  const candidates: RecoveryCandidate[] = [];
  const backupPath = `${dirs.bankPath}.bak`;
  const backup = await recoveryCandidateFromFile("bank.json.bak", backupPath, "backup");
  if (backup) candidates.push(backup);

  try {
    const files = (await readdir(dirs.historyDir)).filter((file) => file.endsWith(".json")).sort().reverse();
    for (const file of files.slice(0, 10)) {
      const candidate = await recoveryCandidateFromFile(file, path.join(dirs.historyDir, file), "history");
      if (candidate) candidates.push(candidate);
    }
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  return candidates;
}

export async function recoverBank(candidateId: string): Promise<BankSnapshot> {
  const initialDirs = await getCurrentWorkspaceDirs();
  return withWorkspaceWriteLock(initialDirs.workspaceDir, async () => {
    const dirs = await getCurrentWorkspaceDirs();
    if (dirs.workspaceDir !== initialDirs.workspaceDir) {
      throw new StorageError("恢复目标已不是当前工作区，请重试。", "WORKSPACE_CHANGED", 409);
    }
    const candidates = await listRecoveryCandidatesForDirs(dirs);
    if (!candidates.some((candidate) => candidate.id === candidateId)) {
      throw new StorageError("无效或已过期的恢复候选。", "RECOVERY_CANDIDATE_INVALID");
    }
    const candidatePath =
      candidateId === "bank.json.bak"
        ? `${dirs.bankPath}.bak`
        : path.join(dirs.historyDir, candidateId);
    const bank = parseStoredBank(await readFile(candidatePath, "utf8"));
    await writeJsonFileAtomic(dirs.bankPath, bank, {
      backup: candidateId !== "bank.json.bak"
    });
    const savedRaw = serializeJson(bank);
    return {
      workspacePath: dirs.workspaceDir,
      revision: revisionForContent(savedRaw),
      bank
    };
  });
}

export function workspaceNameFromPath(workspacePath: string): string {
  return path.basename(path.resolve(workspacePath)) || "Untitled Bank";
}

export function getDefaultWorkspaceRoot(): string {
  return path.join(os.homedir(), "Documents", "Kaoyan Math Bank");
}

function safeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function revisionForContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function parseStoredBank(raw: string): Bank {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StorageError("bank.json 不是有效的 JSON。", "BANK_JSON_INVALID");
  }
  return requireValidBank(parsed);
}

function requireValidBank(value: unknown): Bank {
  const validation = validateBankPayload(value);
  if (!validation.ok || !validation.value) {
    throw new StorageError(validation.error ?? "题库数据无效。", "BANK_INVALID");
  }
  return validation.value;
}

async function withWorkspaceWriteLock<T>(workspacePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = workspaceWriteQueues.get(workspacePath) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  workspaceWriteQueues.set(workspacePath, current);
  try {
    return await current;
  } finally {
    if (workspaceWriteQueues.get(workspacePath) === current) {
      workspaceWriteQueues.delete(workspacePath);
    }
  }
}

async function createHistorySnapshot(dirs: WorkspaceDirs, raw: string, revision: string) {
  await mkdir(dirs.historyDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}-${revision.slice(0, 12)}.json`;
  await writeFile(path.join(dirs.historyDir, fileName), raw, "utf8");
  const files = (await readdir(dirs.historyDir)).filter((file) => file.endsWith(".json")).sort().reverse();
  await Promise.all(files.slice(10).map((file) => rm(path.join(dirs.historyDir, file), { force: true })));
}

async function recoveryCandidateFromFile(
  id: string,
  filePath: string,
  source: RecoveryCandidate["source"]
): Promise<RecoveryCandidate | null> {
  try {
    parseStoredBank(await readFile(filePath, "utf8"));
    const metadata = await stat(filePath);
    return {
      id,
      label: source === "backup" ? "最近一次保存前的备份" : `历史快照 ${metadata.mtime.toLocaleString()}`,
      createdAt: metadata.mtime.toISOString(),
      source
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    if (error instanceof StorageError) return null;
    throw error;
  }
}

export async function cleanupOldTempDirs(workspacePath: string, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const { tempDir } = getWorkspaceDirs(workspacePath);
  let entries: string[];
  try {
    entries = await readdir(tempDir);
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
  const cutoff = Date.now() - maxAgeMs;
  await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(tempDir, entry);
      try {
        const metadata = await stat(target);
        if (metadata.mtimeMs < cutoff) {
          await rm(target, { recursive: true, force: true });
        }
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    })
  );
}

export async function workspaceExists(workspacePath: string): Promise<boolean> {
  try {
    const result = await stat(path.join(workspacePath, "bank.json"));
    return result.isFile();
  } catch {
    return false;
  }
}

export async function isKnownWorkspacePath(targetPath: string): Promise<boolean> {
  const resolvedTarget = path.resolve(targetPath);
  const state = await readAppState();
  const allowedPaths = [state.currentWorkspacePath, ...state.recentWorkspacePaths]
    .filter((workspacePath): workspacePath is string => Boolean(workspacePath))
    .map((workspacePath) => path.resolve(workspacePath));
  return allowedPaths.some((workspacePath) => workspacePath === resolvedTarget);
}
