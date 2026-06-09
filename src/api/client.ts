import type {
  AppInfo,
  AssetUploadResponse,
  Bank,
  CompileResponse,
  ExportOrderMode,
  ExportResponse,
  QuestionAsset,
  QuestionItem,
  TexField
} from "../../shared/types.js";
import { appendTex } from "../utils/form.js";

export async function fetchAppInfo(): Promise<AppInfo> {
  return fetchJson<AppInfo>("/api/app");
}

export async function fetchBank(): Promise<Bank> {
  return fetchJson<Bank>("/api/bank");
}

export async function saveBank(bank: Bank): Promise<Bank> {
  const response = await fetch("/api/bank", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bank)
  });
  return readJsonResponse<Bank>(response);
}

export async function createSampleWorkspace(workspacePath: string): Promise<AppInfo> {
  return postJson<AppInfo>("/api/workspaces/create-sample", { workspacePath });
}

export async function createEmptyWorkspace(workspacePath: string): Promise<AppInfo> {
  return postJson<AppInfo>("/api/workspaces/create-empty", { workspacePath });
}

export async function openExistingWorkspace(workspacePath: string): Promise<AppInfo> {
  return postJson<AppInfo>("/api/workspaces/open", { workspacePath });
}

export async function switchWorkspace(workspacePath: string): Promise<AppInfo> {
  return postJson<AppInfo>("/api/workspaces/switch", { workspacePath });
}

export async function moveWorkspace(workspacePath: string, direction: "up" | "down"): Promise<AppInfo> {
  return postJson<AppInfo>("/api/workspaces/move", { workspacePath, direction });
}

export async function removeWorkspace(workspacePath: string): Promise<AppInfo> {
  return postJson<AppInfo>("/api/workspaces/remove", { workspacePath });
}

export async function saveTexPath(texPath: string): Promise<AppInfo> {
  return postJson<AppInfo>("/api/tex-path", { texPath });
}

export async function uploadQuestionAsset(field: TexField, item: QuestionItem, file: File): Promise<{
  asset: QuestionAsset;
  patch: Pick<QuestionItem, "assets"> & Partial<Record<TexField, string>>;
}> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/assets", { method: "POST", body: formData });
  const data = await readJsonResponse<AssetUploadResponse>(response);
  return {
    asset: data.asset,
    patch: {
      assets: [...item.assets, data.asset],
      [field]: appendTex(item[field], data.insertText)
    }
  };
}

export async function compileItem(item: QuestionItem, settings: Bank["settings"]): Promise<CompileResponse> {
  const response = await fetch("/api/compile-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item, settings })
  });
  return readJsonResponse<CompileResponse>(response, { allowErrorPayload: true });
}

export async function exportItems(input: {
  itemIds: string[];
  fileName: string;
  orderMode: ExportOrderMode;
  randomSeed?: string;
}): Promise<ExportResponse> {
  const response = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonResponse<ExportResponse>(response, { allowErrorPayload: true });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return readJsonResponse<T>(response);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return readJsonResponse<T>(response);
}

async function readJsonResponse<T>(
  response: Response,
  options: { allowErrorPayload?: boolean } = {}
): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok && !options.allowErrorPayload) {
    throw new Error(data.error ?? "请求失败。");
  }
  return data;
}
