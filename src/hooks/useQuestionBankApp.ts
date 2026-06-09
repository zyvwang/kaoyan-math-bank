import { useCallback, useEffect, useState } from "react";
import type {
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject
} from "react";
import { fetchAppInfo, fetchBank } from "../api/client.js";
import type { DropPosition } from "../itemOrder.js";
import type {
  AppInfo,
  Bank,
  CompileResponse,
  ExportOrderMode,
  ModuleKind,
  QuestionItem
} from "../../shared/types.js";
import type { AddMenu, AddMode, Notice, ReorderMenu, SaveState } from "./controllerTypes.js";
import { useAutosave } from "./useAutosave.js";
import { useCompileExportActions } from "./useCompileExportActions.js";
import { useQuestionDerivedData } from "./useQuestionDerivedData.js";
import { useQuestionReorder } from "./useQuestionReorder.js";
import { useSelectionFilters } from "./useSelectionFilters.js";
import { useWorkspaceActions } from "./useWorkspaceActions.js";

export type { AddMenu, AddMode, Notice, ReorderMenu, SaveState } from "./controllerTypes.js";

export interface QuestionBankController {
  appInfo: AppInfo | null;
  bank: Bank | null;
  activeId: string | null;
  activeItem: QuestionItem | null;
  orderedItems: QuestionItem[];
  filteredItems: QuestionItem[];
  numberById: Map<string, number>;
  chapters: string[];
  tags: string[];
  selectedIds: Set<string>;
  chapterFilter: string;
  tagFilter: string;
  starFilter: string;
  search: string;
  saveState: SaveState;
  notice: Notice | null;
  exportName: string;
  exportOrderMode: ExportOrderMode;
  randomSeed: string;
  isExporting: boolean;
  isCompiling: boolean;
  compileResult: CompileResponse | null;
  draggingId: string | null;
  dropTarget: { id: string; position: DropPosition } | null;
  reorderMenu: ReorderMenu | null;
  addMenu: AddMenu | null;
  reorderDialogItem: QuestionItem | null;
  reorderTarget: string;
  reorderError: string;
  isChangingWorkspace: boolean;
  texPathDraft: string;
  reorderInputRef: RefObject<HTMLInputElement | null>;
  setActiveId: (id: string | null) => void;
  setChapterFilter: (value: string) => void;
  setTagFilter: (value: string) => void;
  setStarFilter: (value: string) => void;
  setSearch: (value: string) => void;
  setExportName: (value: string) => void;
  setExportOrderMode: (value: ExportOrderMode) => void;
  setRandomSeed: (value: string) => void;
  setTexPathDraft: (value: string) => void;
  setReorderTarget: (value: string) => void;
  setReorderError: (value: string) => void;
  setNotice: (value: Notice | null) => void;
  updateBank: (updater: (current: Bank) => Bank) => void;
  updateItem: (id: string, patch: Partial<QuestionItem>) => void;
  addItem: (mode?: AddMode) => void;
  deleteItem: (id: string) => void;
  deleteActiveItem: () => void;
  moveActive: (direction: -1 | 1) => void;
  openReorderDialog: (id: string) => void;
  closeReorderDialog: () => void;
  submitReorder: (event: FormEvent<HTMLFormElement>) => void;
  openReorderMenu: (event: ReactMouseEvent<HTMLButtonElement>, id: string) => void;
  openAddMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  startPointerDrag: (event: ReactPointerEvent<HTMLSpanElement>, id: string) => void;
  startMouseDrag: (event: ReactMouseEvent<HTMLSpanElement>, id: string) => void;
  toggleSelected: (id: string) => void;
  toggleAllFiltered: () => void;
  createSampleWorkspace: () => Promise<void>;
  createNewWorkspace: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  switchToWorkspace: (workspacePath: string) => Promise<void>;
  moveWorkspaceInList: (workspacePath: string, direction: "up" | "down") => Promise<void>;
  deleteWorkspace: (workspacePath: string) => Promise<void>;
  saveTexPathOverride: () => Promise<void>;
  openCurrentWorkspaceFolder: () => void;
  uploadAsset: (kind: ModuleKind, file: File) => Promise<void>;
  compileCurrentItem: () => Promise<void>;
  exportSelected: () => Promise<void>;
}

export function useQuestionBankApp(): QuestionBankController {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const selection = useSelectionFilters();
  const derived = useQuestionDerivedData(bank, activeId, {
    chapterFilter: selection.chapterFilter,
    tagFilter: selection.tagFilter,
    starFilter: selection.starFilter,
    search: selection.search
  });
  const autosave = useAutosave(bank, setNotice);
  const { persistBank, saveState, skipNextAutosave } = autosave;

  const updateBank = useCallback((updater: (current: Bank) => Bank) => {
    setBank((current) => (current ? updater(current) : current));
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<QuestionItem>) => {
      updateBank((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
        )
      }));
    },
    [updateBank]
  );

  const compileExport = useCompileExportActions({
    activeItem: derived.activeItem,
    bank,
    selectedIds: selection.selectedIds,
    persistBank,
    setNotice,
    updateItem
  });
  const { clearFilters, selectAllItems } = selection;
  const { setCompileResult } = compileExport;

  const reloadWorkspace = useCallback(
    async (nextAppInfo: AppInfo) => {
      const nextBank = await fetchBank();
      skipNextAutosave();
      setAppInfo(nextAppInfo);
      setBank(nextBank);
      setActiveId(nextBank.items[0]?.id ?? null);
      selectAllItems(nextBank.items);
      clearFilters();
      setCompileResult(null);
    },
    [clearFilters, selectAllItems, setCompileResult, skipNextAutosave]
  );

  const workspace = useWorkspaceActions({
    appInfo,
    bank,
    persistBank,
    reloadWorkspace,
    setAppInfo,
    setNotice
  });

  const reorder = useQuestionReorder({
    activeItem: derived.activeItem,
    numberById: derived.numberById,
    orderedItems: derived.orderedItems,
    setActiveId,
    setNotice,
    setSelectedIds: selection.setSelectedIds,
    updateBank,
    clearFilters
  });

  const loadAppAndBank = useCallback(async () => {
    const [nextAppInfo, nextBank] = await Promise.all([fetchAppInfo(), fetchBank()]);
    skipNextAutosave();
    setAppInfo(nextAppInfo);
    setBank(nextBank);
    setActiveId(nextBank.items[0]?.id ?? null);
    selectAllItems(nextBank.items);
    setCompileResult(null);
  }, [selectAllItems, setCompileResult, skipNextAutosave]);

  useEffect(() => {
    loadAppAndBank().catch((error) => {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "读取题库失败。" });
    });
  }, [loadAppAndBank]);

  return {
    appInfo,
    bank,
    activeId,
    activeItem: derived.activeItem,
    orderedItems: derived.orderedItems,
    filteredItems: derived.filteredItems,
    numberById: derived.numberById,
    chapters: derived.chapters,
    tags: derived.tags,
    selectedIds: selection.selectedIds,
    chapterFilter: selection.chapterFilter,
    tagFilter: selection.tagFilter,
    starFilter: selection.starFilter,
    search: selection.search,
    saveState,
    notice,
    exportName: compileExport.exportName,
    exportOrderMode: compileExport.exportOrderMode,
    randomSeed: compileExport.randomSeed,
    isExporting: compileExport.isExporting,
    isCompiling: compileExport.isCompiling,
    compileResult: compileExport.compileResult,
    draggingId: reorder.draggingId,
    dropTarget: reorder.dropTarget,
    reorderMenu: reorder.reorderMenu,
    addMenu: reorder.addMenu,
    reorderDialogItem: reorder.reorderDialogItem,
    reorderTarget: reorder.reorderTarget,
    reorderError: reorder.reorderError,
    isChangingWorkspace: workspace.isChangingWorkspace,
    texPathDraft: workspace.texPathDraft,
    reorderInputRef: reorder.reorderInputRef,
    setActiveId,
    setChapterFilter: selection.setChapterFilter,
    setTagFilter: selection.setTagFilter,
    setStarFilter: selection.setStarFilter,
    setSearch: selection.setSearch,
    setExportName: compileExport.setExportName,
    setExportOrderMode: compileExport.setExportOrderMode,
    setRandomSeed: compileExport.setRandomSeed,
    setTexPathDraft: workspace.setTexPathDraft,
    setReorderTarget: reorder.setReorderTarget,
    setReorderError: reorder.setReorderError,
    setNotice,
    updateBank,
    updateItem,
    addItem: reorder.addItem,
    deleteItem: reorder.deleteItem,
    deleteActiveItem: reorder.deleteActiveItem,
    moveActive: reorder.moveActive,
    openReorderDialog: reorder.openReorderDialog,
    closeReorderDialog: reorder.closeReorderDialog,
    submitReorder: reorder.submitReorder,
    openReorderMenu: reorder.openReorderMenu,
    openAddMenu: reorder.openAddMenu,
    startPointerDrag: reorder.startPointerDrag,
    startMouseDrag: reorder.startMouseDrag,
    toggleSelected: selection.toggleSelected,
    toggleAllFiltered: () => selection.toggleAllFiltered(derived.filteredItems),
    createSampleWorkspace: workspace.createSampleWorkspace,
    createNewWorkspace: workspace.createNewWorkspace,
    openWorkspace: workspace.openWorkspace,
    switchToWorkspace: workspace.switchToWorkspace,
    moveWorkspaceInList: workspace.moveWorkspaceInList,
    deleteWorkspace: workspace.deleteWorkspace,
    saveTexPathOverride: workspace.saveTexPathOverride,
    openCurrentWorkspaceFolder: workspace.openCurrentWorkspaceFolder,
    uploadAsset: compileExport.uploadAsset,
    compileCurrentItem: compileExport.compileCurrentItem,
    exportSelected: compileExport.exportSelected
  };
}
