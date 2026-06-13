import type { ContextValueInput } from "./questionBankContextValueTypes.js";
import { useLatestCallback } from "./useLatestCallback.js";

export function useQuestionBankStableActions(input: ContextValueInput) {
  return {
    retrySave: useLatestCallback(input.retrySave),
    loadAppAndBank: useLatestCallback(input.loadAppAndBank),
    recoverFromCandidate: useLatestCallback(input.recoverFromCandidate),
    flushPendingChanges: useLatestCallback(input.flushPendingChanges),
    updateBank: useLatestCallback(input.updateBank),
    updateItem: useLatestCallback(input.updateItem),
    addItem: useLatestCallback(input.reorder.addItem),
    deleteItem: useLatestCallback(input.reorder.deleteItem),
    deleteActiveItem: useLatestCallback(input.reorder.deleteActiveItem),
    undoDelete: useLatestCallback(input.reorder.undoDelete),
    moveActive: useLatestCallback(input.reorder.moveActive),
    toggleSelected: useLatestCallback(input.selection.toggleSelected),
    toggleAllFiltered: useLatestCallback(() =>
      input.selection.toggleAllFiltered(input.derived.filteredItems)
    ),
    createSampleWorkspace: useLatestCallback(input.workspace.createSampleWorkspace),
    createNewWorkspace: useLatestCallback(input.workspace.createNewWorkspace),
    openWorkspace: useLatestCallback(input.workspace.openWorkspace),
    switchToWorkspace: useLatestCallback(input.workspace.switchToWorkspace),
    relocateWorkspace: useLatestCallback(input.workspace.relocateWorkspace),
    moveWorkspaceInList: useLatestCallback(input.workspace.moveWorkspaceInList),
    deleteWorkspace: useLatestCallback(input.workspace.deleteWorkspace),
    saveTexPathOverride: useLatestCallback(input.workspace.saveTexPathOverride),
    openCurrentWorkspaceFolder: useLatestCallback(input.workspace.openCurrentWorkspaceFolder),
    uploadAsset: useLatestCallback(input.compileExport.uploadAsset),
    compileCurrentItem: useLatestCallback(input.compileExport.compileCurrentItem),
    exportSelected: useLatestCallback(input.compileExport.exportSelected),
    openReorderDialog: useLatestCallback(input.reorder.openReorderDialog),
    closeReorderDialog: useLatestCallback(input.reorder.closeReorderDialog),
    submitReorder: useLatestCallback(input.reorder.submitReorder),
    openReorderMenu: useLatestCallback(input.reorder.openReorderMenu),
    openAddMenu: useLatestCallback(input.reorder.openAddMenu),
    startPointerDrag: useLatestCallback(input.reorder.startPointerDrag),
    startMouseDrag: useLatestCallback(input.reorder.startMouseDrag)
  };
}
