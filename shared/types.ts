export interface QuestionAsset {
  id: string;
  fileName: string;
  originalName: string;
  relativePath: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface QuestionItem {
  id: string;
  order: number;
  sourceNumber?: string;
  chapter: string;
  tags: string[];
  star: StarRating;
  questionTex: string;
  solutionTex: string;
  noteTex: string;
  assets: QuestionAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface LatexSettings {
  preamble: string;
  pageSize: "a4";
  spacing: {
    item: string;
    module: string;
  };
}

export interface Bank {
  version: 1;
  settings: LatexSettings;
  items: QuestionItem[];
}

export interface AppState {
  version: 1;
  currentWorkspacePath?: string;
  recentWorkspacePaths: string[];
  texPathOverride?: string;
}

export interface WorkspaceSummary {
  name: string;
  path: string;
  exists: boolean;
}

export interface TexStatus {
  available: boolean;
  command?: string;
  source: "override" | "path" | "common" | "missing";
  version?: string;
  message: string;
}

export interface AppInfo {
  appState: AppState;
  currentWorkspaceName: string;
  currentWorkspacePath: string;
  recentWorkspaces: WorkspaceSummary[];
  texStatus: TexStatus;
  isDesktop: boolean;
  setupRequired: boolean;
}

export interface CompileResult {
  ok: boolean;
  texPath: string;
  pdfPath?: string;
  log: string;
}

export interface CompileResponse extends CompileResult {
  texUrl?: string;
  pdfUrl?: string;
}

export interface ExportResponse {
  ok: boolean;
  exportName: string;
  exportPath: string;
  exportUrl: string;
  files: string[];
  results: {
    questions: CompileResponse;
    full: CompileResponse;
  };
}

export interface AssetUploadResponse {
  asset: QuestionAsset;
  url: string;
  insertText: string;
}

export interface WorkspacePathRequest {
  workspacePath: string;
}

export interface WorkspaceMoveRequest extends WorkspacePathRequest {
  direction: "up" | "down";
}

export interface TexPathRequest {
  texPath?: string;
}

export interface CompileItemRequest {
  item: QuestionItem;
  settings: LatexSettings;
}

export interface ExportRequest {
  itemIds: string[];
  fileName: string;
  orderMode?: ExportOrderMode;
  randomSeed?: string;
}

export interface ApiErrorResponse {
  error: string;
}

export type TexField = "questionTex" | "solutionTex" | "noteTex";
export type ExportOrderMode = "normal" | "random";
export type StarRating = 1 | 2 | 3 | 4 | 5;
