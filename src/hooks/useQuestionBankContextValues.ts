import { useMemo } from "react";
import type { QuestionBankContextValues } from "../context/questionBankContextTypes.js";
import type { ContextValueInput } from "./questionBankContextValueTypes.js";
import { useQuestionBankStableActions } from "./useQuestionBankStableActions.js";

export function useQuestionBankContextValues(
  input: ContextValueInput
): QuestionBankContextValues {
  const stable = useQuestionBankStableActions(input);

  const lifecycle = useMemo<QuestionBankContextValues["lifecycle"]>(() => ({
    saveState: input.saveState,
    notice: input.notice,
    loadError: input.loadError,
    recoveryCandidates: input.recoveryCandidates,
    setNotice: input.setNotice,
    retrySave: stable.retrySave,
    retryInitialLoad: stable.loadAppAndBank,
    recoverFromCandidate: stable.recoverFromCandidate,
    flushPendingChanges: stable.flushPendingChanges
  }), [
    input.loadError,
    input.notice,
    input.recoveryCandidates,
    input.saveState,
    input.setNotice,
    stable.flushPendingChanges,
    stable.loadAppAndBank,
    stable.recoverFromCandidate,
    stable.retrySave
  ]);

  const workspace = useMemo<QuestionBankContextValues["workspace"]>(() => ({
    appInfo: input.appInfo,
    isChangingWorkspace: input.workspace.isChangingWorkspace,
    texPathDraft: input.workspace.texPathDraft,
    setTexPathDraft: input.workspace.setTexPathDraft,
    createSampleWorkspace: stable.createSampleWorkspace,
    createNewWorkspace: stable.createNewWorkspace,
    openWorkspace: stable.openWorkspace,
    switchToWorkspace: stable.switchToWorkspace,
    relocateWorkspace: stable.relocateWorkspace,
    moveWorkspaceInList: stable.moveWorkspaceInList,
    deleteWorkspace: stable.deleteWorkspace,
    saveTexPathOverride: stable.saveTexPathOverride,
    openCurrentWorkspaceFolder: stable.openCurrentWorkspaceFolder
  }), [
    input.appInfo,
    input.workspace.isChangingWorkspace,
    input.workspace.setTexPathDraft,
    input.workspace.texPathDraft,
    stable.createNewWorkspace,
    stable.createSampleWorkspace,
    stable.deleteWorkspace,
    stable.moveWorkspaceInList,
    stable.openCurrentWorkspaceFolder,
    stable.openWorkspace,
    stable.relocateWorkspace,
    stable.saveTexPathOverride,
    stable.switchToWorkspace
  ]);

  const questions = useMemo<QuestionBankContextValues["questions"]>(() => ({
    bank: input.bank,
    activeId: input.activeId,
    activeItem: input.derived.activeItem,
    orderedItems: input.derived.orderedItems,
    numberById: input.derived.numberById,
    setActiveId: input.setActiveId,
    updateBank: stable.updateBank,
    updateItem: stable.updateItem,
    addItem: stable.addItem,
    deleteItem: stable.deleteItem,
    deleteActiveItem: stable.deleteActiveItem,
    undoDelete: stable.undoDelete,
    moveActive: stable.moveActive,
    canUndoDelete: input.reorder.canUndoDelete
  }), [
    input.activeId,
    input.bank,
    input.derived.activeItem,
    input.derived.numberById,
    input.derived.orderedItems,
    input.reorder.canUndoDelete,
    input.setActiveId,
    stable.addItem,
    stable.deleteActiveItem,
    stable.deleteItem,
    stable.moveActive,
    stable.undoDelete,
    stable.updateBank,
    stable.updateItem
  ]);

  const selection = useMemo<QuestionBankContextValues["selection"]>(() => ({
    filteredItems: input.derived.filteredItems,
    chapters: input.derived.chapters,
    tags: input.derived.tags,
    selectedIds: input.selection.selectedIds,
    chapterFilter: input.selection.chapterFilter,
    tagFilter: input.selection.tagFilter,
    starFilter: input.selection.starFilter,
    search: input.selection.search,
    setChapterFilter: input.selection.setChapterFilter,
    setTagFilter: input.selection.setTagFilter,
    setStarFilter: input.selection.setStarFilter,
    setSearch: input.selection.setSearch,
    toggleSelected: stable.toggleSelected,
    toggleAllFiltered: stable.toggleAllFiltered
  }), [
    input.derived.chapters,
    input.derived.filteredItems,
    input.derived.tags,
    input.selection.chapterFilter,
    input.selection.search,
    input.selection.setChapterFilter,
    input.selection.setSearch,
    input.selection.setStarFilter,
    input.selection.setTagFilter,
    input.selection.selectedIds,
    input.selection.starFilter,
    input.selection.tagFilter,
    stable.toggleAllFiltered,
    stable.toggleSelected
  ]);

  const compileExport = useMemo<QuestionBankContextValues["compileExport"]>(() => ({
    exportName: input.compileExport.exportName,
    exportOrderMode: input.compileExport.exportOrderMode,
    randomSeed: input.compileExport.randomSeed,
    isExporting: input.compileExport.isExporting,
    isCompiling: input.compileExport.isCompiling,
    compileResult: input.compileExport.compileResult,
    exportFailureResult: input.compileExport.exportFailureResult,
    compileStatus: input.compileExport.compileStatus,
    setExportName: input.compileExport.setExportName,
    setExportOrderMode: input.compileExport.setExportOrderMode,
    setRandomSeed: input.compileExport.setRandomSeed,
    uploadAsset: stable.uploadAsset,
    compileCurrentItem: stable.compileCurrentItem,
    exportSelected: stable.exportSelected
  }), [
    input.compileExport.compileResult,
    input.compileExport.compileStatus,
    input.compileExport.exportName,
    input.compileExport.exportFailureResult,
    input.compileExport.exportOrderMode,
    input.compileExport.isCompiling,
    input.compileExport.isExporting,
    input.compileExport.randomSeed,
    input.compileExport.setExportName,
    input.compileExport.setExportOrderMode,
    input.compileExport.setRandomSeed,
    stable.compileCurrentItem,
    stable.exportSelected,
    stable.uploadAsset
  ]);

  const workspaceUi = useMemo<QuestionBankContextValues["workspaceUi"]>(() => ({
    activeModule: input.activeModule,
    setActiveModule: input.setActiveModule,
    draggingId: input.reorder.draggingId,
    dropTarget: input.reorder.dropTarget,
    reorderMenu: input.reorder.reorderMenu,
    addMenu: input.reorder.addMenu,
    reorderDialogItem: input.reorder.reorderDialogItem,
    reorderTarget: input.reorder.reorderTarget,
    reorderError: input.reorder.reorderError,
    reorderInputRef: input.reorder.reorderInputRef,
    setReorderTarget: input.reorder.setReorderTarget,
    setReorderError: input.reorder.setReorderError,
    openReorderDialog: stable.openReorderDialog,
    closeReorderDialog: stable.closeReorderDialog,
    submitReorder: stable.submitReorder,
    openReorderMenu: stable.openReorderMenu,
    openAddMenu: stable.openAddMenu,
    startPointerDrag: stable.startPointerDrag,
    startMouseDrag: stable.startMouseDrag
  }), [
    input.activeModule,
    input.reorder.addMenu,
    input.reorder.draggingId,
    input.reorder.dropTarget,
    input.reorder.reorderDialogItem,
    input.reorder.reorderError,
    input.reorder.reorderMenu,
    input.reorder.reorderTarget,
    input.reorder.reorderInputRef,
    input.reorder.setReorderError,
    input.reorder.setReorderTarget,
    input.setActiveModule,
    stable.closeReorderDialog,
    stable.openAddMenu,
    stable.openReorderDialog,
    stable.openReorderMenu,
    stable.startMouseDrag,
    stable.startPointerDrag,
    stable.submitReorder
  ]);

  return { lifecycle, workspace, questions, selection, compileExport, workspaceUi };
}
