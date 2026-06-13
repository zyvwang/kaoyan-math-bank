import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAppInfo,
  fetchBank,
  fetchRecoveryCandidates,
  recoverBank
} from "../api/client.js";
import type {
  AppInfo,
  Bank,
  BankSnapshot,
  ModuleKind,
  QuestionItem
} from "../../shared/types.js";
import type { QuestionBankContextValues } from "../context/questionBankContextTypes.js";
import { useAutosave } from "./useAutosave.js";
import { useCompileExportActions } from "./useCompileExportActions.js";
import { useQuestionDerivedData } from "./useQuestionDerivedData.js";
import { useQuestionBankContextValues } from "./useQuestionBankContextValues.js";
import { useQuestionReorder } from "./useQuestionReorder.js";
import { useSelectionFilters } from "./useSelectionFilters.js";
import { useWorkspaceActions } from "./useWorkspaceActions.js";

export function useQuestionBankModel(): QuestionBankContextValues {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<QuestionBankContextValues["lifecycle"]["notice"]>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recoveryCandidates, setRecoveryCandidates] = useState<
    QuestionBankContextValues["lifecycle"]["recoveryCandidates"]
  >([]);
  const [activeModule, setActiveModule] = useState<ModuleKind>("question");
  const selection = useSelectionFilters();
  const filters = useMemo(
    () => ({
      chapterFilter: selection.chapterFilter,
      tagFilter: selection.tagFilter,
      starFilter: selection.starFilter,
      search: selection.search
    }),
    [
      selection.chapterFilter,
      selection.search,
      selection.starFilter,
      selection.tagFilter
    ]
  );
  const derived = useQuestionDerivedData(bank, activeId, filters);
  const autosave = useAutosave(bank, setNotice);
  const { persistBank, resetAutosave, retrySave, saveState } = autosave;

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
    workspacePath: appInfo?.currentWorkspacePath ?? "",
    selectedIds: selection.selectedIds,
    persistBank,
    setNotice,
    updateItem
  });
  const { clearFilters, selectAllItems } = selection;
  const { resetCompileState } = compileExport;

  const applyBankSnapshot = useCallback(
    (nextAppInfo: AppInfo, snapshot: BankSnapshot) => {
      resetAutosave(snapshot);
      setAppInfo(nextAppInfo);
      setBank(snapshot.bank);
      setActiveId(snapshot.bank.items[0]?.id ?? null);
      selectAllItems(snapshot.bank.items);
      clearFilters();
      resetCompileState();
      setLoadError(null);
      setRecoveryCandidates([]);
      setActiveModule("question");
    },
    [clearFilters, resetAutosave, resetCompileState, selectAllItems]
  );
  const reloadWorkspace = useCallback(
    async (nextAppInfo: AppInfo) => {
      applyBankSnapshot(nextAppInfo, await fetchBank());
    },
    [applyBankSnapshot]
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
    clearFilters,
    workspacePath: appInfo?.currentWorkspacePath ?? ""
  });

  const loadAppAndBank = useCallback(async () => {
    setLoadError(null);
    const nextAppInfo = await fetchAppInfo();
    setAppInfo(nextAppInfo);
    applyBankSnapshot(nextAppInfo, await fetchBank());
  }, [applyBankSnapshot]);

  useEffect(() => {
    loadAppAndBank().catch((error) => {
      const message = error instanceof Error ? error.message : "读取题库失败。";
      setLoadError(message);
      setNotice({ type: "error", text: message });
      fetchRecoveryCandidates()
        .then(setRecoveryCandidates)
        .catch(() => setRecoveryCandidates([]));
    });
  }, [loadAppAndBank]);

  const recoverFromCandidate = useCallback(
    async (candidateId: string) => {
      const snapshot = await recoverBank(candidateId);
      resetAutosave(snapshot);
      setBank(snapshot.bank);
      setActiveId(snapshot.bank.items[0]?.id ?? null);
      selectAllItems(snapshot.bank.items);
      setLoadError(null);
      setRecoveryCandidates([]);
      setNotice({ type: "ok", text: "题库已从备份恢复。" });
    },
    [resetAutosave, selectAllItems]
  );
  const flushPendingChanges = useCallback(async () => {
    if (bank && appInfo?.currentWorkspacePath) await persistBank(bank);
  }, [appInfo?.currentWorkspacePath, bank, persistBank]);

  return useQuestionBankContextValues({
    appInfo,
    bank,
    activeId,
    notice,
    loadError,
    recoveryCandidates,
    saveState,
    activeModule,
    derived,
    selection,
    compileExport,
    workspace,
    reorder,
    setActiveId,
    setNotice,
    setActiveModule,
    updateBank,
    updateItem,
    retrySave,
    loadAppAndBank,
    recoverFromCandidate,
    flushPendingChanges
  });
}
