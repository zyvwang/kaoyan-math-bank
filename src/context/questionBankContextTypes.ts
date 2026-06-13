import type {
  Dispatch,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction
} from "react";
import type {
  AppInfo,
  Bank,
  CompileResponse,
  ExportOrderMode,
  ModuleKind,
  QuestionItem,
  RecoveryCandidate
} from "../../shared/types.js";
import type { AddMenu, AddMode, Notice, ReorderMenu, SaveState } from "../hooks/controllerTypes.js";
import type { DropPosition } from "../itemOrder.js";

export interface LifecycleContextValue {
  saveState: SaveState;
  notice: Notice | null;
  loadError: string | null;
  recoveryCandidates: RecoveryCandidate[];
  setNotice: (notice: Notice | null) => void;
  retrySave: () => Promise<void>;
  retryInitialLoad: () => Promise<void>;
  recoverFromCandidate: (candidateId: string) => Promise<void>;
  flushPendingChanges: () => Promise<void>;
}

export interface WorkspaceContextValue {
  appInfo: AppInfo | null;
  isChangingWorkspace: boolean;
  texPathDraft: string;
  setTexPathDraft: (value: string) => void;
  createSampleWorkspace: () => Promise<void>;
  createNewWorkspace: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  switchToWorkspace: (workspacePath: string) => Promise<void>;
  relocateWorkspace: (workspacePath: string) => Promise<void>;
  moveWorkspaceInList: (workspacePath: string, direction: "up" | "down") => Promise<void>;
  deleteWorkspace: (workspacePath: string) => Promise<void>;
  saveTexPathOverride: () => Promise<void>;
  openCurrentWorkspaceFolder: () => void;
}

export interface QuestionContextValue {
  bank: Bank | null;
  activeId: string | null;
  activeItem: QuestionItem | null;
  orderedItems: QuestionItem[];
  numberById: Map<string, number>;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  updateBank: (updater: (current: Bank) => Bank) => void;
  updateItem: (id: string, patch: Partial<QuestionItem>) => void;
  addItem: (mode?: AddMode) => void;
  deleteItem: (id: string) => void;
  deleteActiveItem: () => void;
  undoDelete: () => void;
  moveActive: (direction: -1 | 1) => void;
  canUndoDelete: boolean;
}

export interface SelectionContextValue {
  filteredItems: QuestionItem[];
  chapters: string[];
  tags: string[];
  selectedIds: Set<string>;
  chapterFilter: string;
  tagFilter: string;
  starFilter: string;
  search: string;
  setChapterFilter: (value: string) => void;
  setTagFilter: (value: string) => void;
  setStarFilter: (value: string) => void;
  setSearch: (value: string) => void;
  toggleSelected: (id: string) => void;
  toggleAllFiltered: () => void;
}

export interface CompileExportContextValue {
  exportName: string;
  exportOrderMode: ExportOrderMode;
  randomSeed: string;
  isExporting: boolean;
  isCompiling: boolean;
  compileResult: CompileResponse | null;
  setExportName: (value: string) => void;
  setExportOrderMode: (value: ExportOrderMode) => void;
  setRandomSeed: (value: string) => void;
  uploadAsset: (kind: ModuleKind, file: File) => Promise<void>;
  compileCurrentItem: () => Promise<void>;
  exportSelected: () => Promise<void>;
}

export type EditorMode = "focus" | "overview";

export interface WorkspaceUiContextValue {
  activeModule: ModuleKind;
  editorMode: EditorMode;
  draggingId: string | null;
  dropTarget: { id: string; position: DropPosition } | null;
  reorderMenu: ReorderMenu | null;
  addMenu: AddMenu | null;
  reorderDialogItem: QuestionItem | null;
  reorderTarget: string;
  reorderError: string;
  reorderInputRef: RefObject<HTMLInputElement | null>;
  setActiveModule: (kind: ModuleKind) => void;
  setEditorMode: (mode: EditorMode) => void;
  setReorderTarget: (value: string) => void;
  setReorderError: (value: string) => void;
  openReorderDialog: (id: string) => void;
  closeReorderDialog: () => void;
  submitReorder: (event: FormEvent<HTMLFormElement>) => void;
  openReorderMenu: (event: ReactMouseEvent<HTMLElement>, id: string) => void;
  openAddMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  startPointerDrag: (event: ReactPointerEvent<HTMLSpanElement>, id: string) => void;
  startMouseDrag: (event: ReactMouseEvent<HTMLSpanElement>, id: string) => void;
}

export interface QuestionBankContextValues {
  lifecycle: LifecycleContextValue;
  workspace: WorkspaceContextValue;
  questions: QuestionContextValue;
  selection: SelectionContextValue;
  compileExport: CompileExportContextValue;
  workspaceUi: WorkspaceUiContextValue;
}
