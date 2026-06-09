import type {
  Bank,
  CompileItemRequest,
  ExportOrderMode,
  ExportRequest,
  LatexSettings,
  QuestionAsset,
  QuestionItem,
  TexPathRequest,
  WorkspaceMoveRequest,
  WorkspacePathRequest
} from "./types.js";

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateBankPayload(value: unknown): ValidationResult<Bank> {
  if (!isRecord(value)) return invalid("题库数据必须是对象。");
  if (value.version !== 1) return invalid("题库版本必须为 1。");
  if (!isRecord(value.settings)) return invalid("题库缺少 settings。");
  if (!Array.isArray(value.items)) return invalid("题库 items 必须是数组。");
  return { ok: true, value: value as unknown as Bank };
}

export function validateWorkspacePathRequest(value: unknown, missingMessage = "缺少工作区路径。"): ValidationResult<WorkspacePathRequest> {
  if (!isRecord(value)) return invalid("请求体必须是对象。");
  const workspacePath = getStringField(value, "workspacePath");
  if (workspacePath === undefined) return invalid("workspacePath 必须是字符串。");
  if (!workspacePath) return invalid(missingMessage);
  return { ok: true, value: { workspacePath } };
}

export function validateWorkspaceMoveRequest(value: unknown): ValidationResult<WorkspaceMoveRequest> {
  const pathResult = validateWorkspacePathRequest(value);
  if (!pathResult.ok || !pathResult.value) return pathResult as ValidationResult<WorkspaceMoveRequest>;
  if (!isRecord(value)) return invalid("请求体必须是对象。");
  const direction = value.direction;
  if (direction !== "up" && direction !== "down") {
    return invalid("工作区移动方向必须是 up 或 down。");
  }
  return { ok: true, value: { workspacePath: pathResult.value.workspacePath, direction } };
}

export function validateTexPathRequest(value: unknown): ValidationResult<TexPathRequest> {
  if (!isRecord(value)) return invalid("请求体必须是对象。");
  const texPath = getOptionalStringField(value, "texPath");
  if (texPath instanceof ValidationError) return invalid(texPath.message);
  return { ok: true, value: { texPath: texPath || undefined } };
}

export function validateCompileItemRequest(value: unknown): ValidationResult<CompileItemRequest> {
  if (!isRecord(value)) return invalid("请求体必须是对象。");
  if (!isQuestionItem(value.item)) return invalid("缺少有效的当前题目。");
  if (!isLatexSettings(value.settings)) return invalid("缺少有效的 LaTeX 设置。");
  return { ok: true, value: { item: value.item, settings: value.settings } };
}

export function validateExportRequest(value: unknown): ValidationResult<ExportRequest> {
  if (!isRecord(value)) return invalid("请求体必须是对象。");
  if (!Array.isArray(value.itemIds) || !value.itemIds.every((item) => typeof item === "string")) {
    return invalid("导出题目列表必须是字符串数组。");
  }
  const fileName = getStringField(value, "fileName");
  if (fileName === undefined) return invalid("fileName 必须是字符串。");
  let orderMode: ExportOrderMode | undefined;
  try {
    orderMode = optionalExportOrderMode(value.orderMode);
  } catch (error) {
    if (error instanceof ValidationError) return invalid(error.message);
    throw error;
  }
  const randomSeed = getOptionalStringField(value, "randomSeed");
  if (randomSeed instanceof ValidationError) return invalid(randomSeed.message);
  return {
    ok: true,
    value: {
      itemIds: value.itemIds,
      fileName,
      orderMode,
      randomSeed: randomSeed || undefined
    }
  };
}

function isQuestionItem(value: unknown): value is QuestionItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    Number.isFinite(value.order) &&
    typeof value.chapter === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    isStarRating(value.star) &&
    typeof value.questionTex === "string" &&
    typeof value.solutionTex === "string" &&
    typeof value.noteTex === "string" &&
    Array.isArray(value.assets) &&
    value.assets.every(isQuestionAsset) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isQuestionAsset(value: unknown): value is QuestionAsset {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.fileName === "string" &&
    typeof value.originalName === "string" &&
    typeof value.relativePath === "string" &&
    typeof value.mimeType === "string" &&
    Number.isFinite(value.size) &&
    typeof value.uploadedAt === "string"
  );
}

function isLatexSettings(value: unknown): value is LatexSettings {
  if (!isRecord(value) || !isRecord(value.spacing)) return false;
  return (
    value.pageSize === "a4" &&
    typeof value.preamble === "string" &&
    typeof value.spacing.item === "string" &&
    typeof value.spacing.module === "string"
  );
}

function isStarRating(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

function optionalExportOrderMode(value: unknown): ExportOrderMode | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "normal" || value === "random") return value;
  throw new ValidationError("导出顺序必须是 normal 或 random。");
}

function getStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function getOptionalStringField(record: Record<string, unknown>, key: string): string | ValidationError | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return new ValidationError(`${key} 必须是字符串。`);
  return value.trim();
}

function invalid<T>(error: string): ValidationResult<T> {
  return { ok: false, error };
}

export class ValidationError extends Error {}
