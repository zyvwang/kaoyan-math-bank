import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject
} from "react";
import {
  compileItem,
  createEmptyWorkspace,
  createSampleWorkspace as createSampleWorkspaceRequest,
  exportItems,
  fetchAppInfo,
  fetchBank,
  moveWorkspace,
  openExistingWorkspace,
  removeWorkspace,
  saveBank,
  saveTexPath,
  switchWorkspace as switchWorkspaceRequest,
  uploadQuestionAsset
} from "../api/client.js";
import { DEFAULT_STAR_RATING } from "../constants.js";
import {
  moveItemToPositionInList,
  reorderItemByDrop,
  withOrder,
  type DropPosition
} from "../itemOrder.js";
import type {
  AppInfo,
  Bank,
  CompileResponse,
  ExportOrderMode,
  ExportResponse,
  QuestionItem,
  TexField
} from "../../shared/types.js";

export type SaveState = "idle" | "saving" | "saved" | "error";
export type Notice = { type: "ok" | "error" | "info"; text: string; href?: string };
export type ReorderMenu = { id: string; x: number; y: number };
export type AddMenu = { x: number; y: number };
export type AddMode = { type: "append" } | { type: "insertAfter"; afterId: string };

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
  uploadAsset: (field: TexField, file: File) => Promise<void>;
  compileCurrentItem: () => Promise<void>;
  exportSelected: () => Promise<void>;
}

export function useQuestionBankApp(): QuestionBankController {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [chapterFilter, setChapterFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [starFilter, setStarFilter] = useState("");
  const [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [exportName, setExportName] = useState(`math-${new Date().toISOString().slice(0, 10)}`);
  const [exportOrderMode, setExportOrderMode] = useState<ExportOrderMode>("normal");
  const [randomSeed, setRandomSeed] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResponse | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);
  const [reorderMenu, setReorderMenu] = useState<ReorderMenu | null>(null);
  const [addMenu, setAddMenu] = useState<AddMenu | null>(null);
  const [reorderDialogId, setReorderDialogId] = useState<string | null>(null);
  const [reorderTarget, setReorderTarget] = useState("");
  const [reorderError, setReorderError] = useState("");
  const [isChangingWorkspace, setIsChangingWorkspace] = useState(false);
  const [texPathDraft, setTexPathDraft] = useState("");
  const skipNextSave = useRef(true);
  const draggingIdRef = useRef<string | null>(null);
  const dropTargetRef = useRef<{ id: string; position: DropPosition } | null>(null);
  const reorderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadAppAndBank().catch((error) => {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "读取题库失败。" });
    });
  }, []);

  const orderedItems = useMemo(() => {
    return [...(bank?.items ?? [])].sort((a, b) => a.order - b.order);
  }, [bank]);

  const numberById = useMemo(() => {
    return new Map(orderedItems.map((item, index) => [item.id, index + 1]));
  }, [orderedItems]);

  const chapters = useMemo(() => {
    return [...new Set(orderedItems.map((item) => item.chapter.trim()).filter(Boolean))].sort();
  }, [orderedItems]);

  const tags = useMemo(() => {
    return [...new Set(orderedItems.flatMap((item) => item.tags).map((tag) => tag.trim()).filter(Boolean))].sort();
  }, [orderedItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orderedItems.filter((item) => {
      const matchesChapter = !chapterFilter || item.chapter === chapterFilter;
      const matchesTag = !tagFilter || item.tags.includes(tagFilter);
      const matchesStar = !starFilter || item.star === Number(starFilter);
      const haystack = [
        item.sourceNumber,
        item.chapter,
        `${item.star}星`,
        item.tags.join(" "),
        item.questionTex,
        item.solutionTex,
        item.noteTex
      ]
        .join(" ")
        .toLowerCase();
      return matchesChapter && matchesTag && matchesStar && (!term || haystack.includes(term));
    });
  }, [chapterFilter, orderedItems, search, starFilter, tagFilter]);

  const activeItem = useMemo(() => {
    return orderedItems.find((item) => item.id === activeId) ?? orderedItems[0] ?? null;
  }, [activeId, orderedItems]);

  const reorderDialogItem = useMemo(() => {
    return orderedItems.find((item) => item.id === reorderDialogId) ?? null;
  }, [orderedItems, reorderDialogId]);

  const persistBank = useCallback(async (nextBank: Bank) => {
    setSaveState("saving");
    await saveBank(nextBank);
    setSaveState("saved");
  }, []);

  useEffect(() => {
    if (!bank) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSaveState("saving");
    const timer = window.setTimeout(() => {
      persistBank(bank).catch((error) => {
        setSaveState("error");
        setNotice({ type: "error", text: error instanceof Error ? error.message : "保存题库失败。" });
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [bank, persistBank]);

  useEffect(() => {
    if (!reorderDialogId) return;
    window.setTimeout(() => reorderInputRef.current?.select(), 0);
  }, [reorderDialogId]);

  useEffect(() => {
    if (!reorderMenu && !addMenu) return;

    function closeFromPointer(event: Event) {
      if (event.target instanceof Element && event.target.closest(".contextMenu")) return;
      setReorderMenu(null);
      setAddMenu(null);
    }

    function closeFromKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setReorderMenu(null);
      setAddMenu(null);
    }

    window.addEventListener("pointerdown", closeFromPointer);
    window.addEventListener("scroll", closeFromPointer, true);
    window.addEventListener("keydown", closeFromKey);
    return () => {
      window.removeEventListener("pointerdown", closeFromPointer);
      window.removeEventListener("scroll", closeFromPointer, true);
      window.removeEventListener("keydown", closeFromKey);
    };
  }, [addMenu, reorderMenu]);

  useEffect(() => {
    function setCurrentDropTarget(next: { id: string; position: DropPosition } | null) {
      dropTargetRef.current = next;
      setDropTarget((current) =>
        current?.id === next?.id && current?.position === next?.position ? current : next
      );
    }

    function updateDropFromPoint(clientX: number, clientY: number) {
      const draggedId = draggingIdRef.current;
      if (!draggedId) return;

      const element = document.elementFromPoint(clientX, clientY);
      const row = element?.closest("[data-question-id]") as HTMLElement | null;
      const targetId = row?.dataset.questionId;
      if (!row || !targetId || targetId === draggedId) {
        setCurrentDropTarget(null);
        return;
      }

      const bounds = row.getBoundingClientRect();
      const position: DropPosition = clientY < bounds.top + bounds.height / 2 ? "before" : "after";
      setCurrentDropTarget({ id: targetId, position });
    }

    function handlePointerMove(event: PointerEvent) {
      if (!draggingIdRef.current) return;
      event.preventDefault();
      updateDropFromPoint(event.clientX, event.clientY);
    }

    function handleMouseMove(event: MouseEvent) {
      if (!draggingIdRef.current) return;
      event.preventDefault();
      updateDropFromPoint(event.clientX, event.clientY);
    }

    function finishDrag() {
      const draggedId = draggingIdRef.current;
      const target = dropTargetRef.current;
      if (draggedId && target) {
        const nextItems = reorderItemByDrop(orderedItems, draggedId, target.id, target.position);
        updateBank((current) => ({ ...current, items: nextItems }));
        setActiveId(draggedId);
      }
      draggingIdRef.current = null;
      dropTargetRef.current = null;
      setDraggingId(null);
      setDropTarget(null);
    }

    function cancelDrag(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      draggingIdRef.current = null;
      dropTargetRef.current = null;
      setDraggingId(null);
      setDropTarget(null);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", finishDrag);
    window.addEventListener("keydown", cancelDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", finishDrag);
      window.removeEventListener("keydown", cancelDrag);
    };
  }, [orderedItems]);

  async function loadAppAndBank() {
    const [nextAppInfo, nextBank] = await Promise.all([fetchAppInfo(), fetchBank()]);
    skipNextSave.current = true;
    setAppInfo(nextAppInfo);
    setTexPathDraft(nextAppInfo.appState.texPathOverride ?? "");
    setBank(nextBank);
    setActiveId(nextBank.items[0]?.id ?? null);
    setSelectedIds(new Set(nextBank.items.map((item) => item.id)));
    setCompileResult(null);
  }

  function updateBank(updater: (current: Bank) => Bank) {
    setBank((current) => (current ? updater(current) : current));
  }

  function updateItem(id: string, patch: Partial<QuestionItem>) {
    updateBank((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
      )
    }));
  }

  function createQuestionItem(chapter = ""): QuestionItem {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      order: orderedItems.length + 1,
      sourceNumber: "",
      chapter,
      tags: [],
      star: DEFAULT_STAR_RATING,
      questionTex: "",
      solutionTex: "",
      noteTex: "",
      assets: [],
      createdAt: now,
      updatedAt: now
    };
  }

  function clearFiltersForNewItem() {
    setChapterFilter("");
    setTagFilter("");
    setStarFilter("");
    setSearch("");
  }

  function addItem(mode: AddMode = { type: "append" }) {
    if (!bank) return;
    let insertIndex = orderedItems.length;
    let inheritedChapter = "";
    let noticeText = `已追加至第 ${orderedItems.length + 1} 题。`;

    if (mode.type === "insertAfter") {
      const anchorIndex = orderedItems.findIndex((item) => item.id === mode.afterId);
      if (anchorIndex === -1) return;
      insertIndex = anchorIndex + 1;
      inheritedChapter = orderedItems[anchorIndex].chapter;
      noticeText = `已插入第 ${insertIndex + 1} 题。`;
    }

    const item = createQuestionItem(inheritedChapter);
    const nextItems = [...orderedItems];
    nextItems.splice(insertIndex, 0, item);
    updateBank((current) => ({ ...current, items: nextItems.map((nextItem, index) => withOrder(nextItem, index)) }));
    setActiveId(item.id);
    setSelectedIds((current) => new Set([...current, item.id]));
    clearFiltersForNewItem();
    setAddMenu(null);
    setReorderMenu(null);
    setNotice({ type: "ok", text: noticeText });
  }

  function deleteItem(id: string) {
    const deletedIndex = orderedItems.findIndex((item) => item.id === id);
    if (deletedIndex === -1) return;
    const remaining = orderedItems
      .filter((item) => item.id !== id)
      .map((remainingItem, index) => withOrder(remainingItem, index));
    updateBank((current) => ({ ...current, items: remaining }));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setActiveId((currentActiveId) =>
      currentActiveId === id ? remaining[Math.min(deletedIndex, remaining.length - 1)]?.id ?? null : currentActiveId
    );
    setReorderMenu(null);
  }

  function deleteActiveItem() {
    if (!activeItem) return;
    deleteItem(activeItem.id);
  }

  function moveActive(direction: -1 | 1) {
    if (!activeItem) return;
    const items = [...orderedItems];
    const index = items.findIndex((item) => item.id === activeItem.id);
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    updateBank((current) => ({
      ...current,
      items: items.map((item, itemIndex) => withOrder(item, itemIndex)),
      settings: current.settings,
      version: current.version
    }));
  }

  function openReorderDialog(id: string) {
    const currentNumber = numberById.get(id);
    if (!currentNumber) return;
    setReorderMenu(null);
    setReorderDialogId(id);
    setReorderTarget(String(currentNumber));
    setReorderError("");
    setActiveId(id);
  }

  function closeReorderDialog() {
    setReorderDialogId(null);
    setReorderTarget("");
    setReorderError("");
  }

  function moveItemToPosition(id: string, targetNumber: number) {
    const nextItems = moveItemToPositionInList(orderedItems, id, targetNumber);
    updateBank((current) => ({ ...current, items: nextItems }));
    setActiveId(id);
  }

  function submitReorder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reorderDialogItem) return;

    const trimmedTarget = reorderTarget.trim();
    if (!/^\d+$/.test(trimmedTarget)) {
      setReorderError("请输入有效的整数题序。");
      return;
    }

    const targetNumber = Number(trimmedTarget);
    if (targetNumber < 1 || targetNumber > orderedItems.length) {
      setReorderError(`题序需在 1 到 ${orderedItems.length} 之间。`);
      return;
    }

    const currentNumber = numberById.get(reorderDialogItem.id);
    if (!currentNumber) return;
    closeReorderDialog();

    if (targetNumber === currentNumber) {
      setNotice({ type: "info", text: "题序未变化。" });
      return;
    }

    moveItemToPosition(reorderDialogItem.id, targetNumber);
    setNotice({ type: "ok", text: `已移动至第 ${targetNumber} 题。` });
  }

  function openReorderMenu(event: ReactMouseEvent<HTMLButtonElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 184;
    const menuHeight = 122;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
    setActiveId(id);
    setAddMenu(null);
    setReorderMenu({ id, x: Math.max(8, x), y: Math.max(8, y) });
  }

  function openAddMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 184;
    const menuHeight = activeItem ? 84 : 46;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 8);
    const y = Math.min(bounds.bottom + 6, window.innerHeight - menuHeight - 8);
    setReorderMenu(null);
    setAddMenu({ x: Math.max(8, x), y: Math.max(8, y) });
  }

  function startPointerDrag(event: ReactPointerEvent<HTMLSpanElement>, id: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    startDrag(id);
  }

  function startMouseDrag(event: ReactMouseEvent<HTMLSpanElement>, id: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    startDrag(id);
  }

  function startDrag(id: string) {
    draggingIdRef.current = id;
    dropTargetRef.current = null;
    setDraggingId(id);
    setDropTarget(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    const filteredIds = filteredItems.map((item) => item.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredIds.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  async function saveBeforeWorkspaceChange() {
    if (bank && appInfo?.currentWorkspacePath) {
      await persistBank(bank);
    }
  }

  async function reloadWorkspace(nextAppInfo: AppInfo) {
    const nextBank = await fetchBank();
    skipNextSave.current = true;
    setAppInfo(nextAppInfo);
    setTexPathDraft(nextAppInfo.appState.texPathOverride ?? "");
    setBank(nextBank);
    setActiveId(nextBank.items[0]?.id ?? null);
    setSelectedIds(new Set(nextBank.items.map((item) => item.id)));
    setCompileResult(null);
    setChapterFilter("");
    setTagFilter("");
    setStarFilter("");
    setSearch("");
  }

  async function pickWorkspaceDirectory(title: string, fallbackPrompt: string): Promise<string | null> {
    if (window.kmb?.selectWorkspaceDirectory) {
      return window.kmb.selectWorkspaceDirectory(title);
    }
    return window.prompt(fallbackPrompt);
  }

  async function createSampleWorkspace() {
    const workspacePath = await pickWorkspaceDirectory(
      "选择示例工作区文件夹",
      "输入示例工作区文件夹路径，例如 /Users/me/Documents/Kaoyan Math Bank/Sample Bank"
    );
    if (!workspacePath?.trim()) return;
    setIsChangingWorkspace(true);
    try {
      const nextAppInfo = await createSampleWorkspaceRequest(workspacePath);
      await reloadWorkspace(nextAppInfo);
      setNotice({ type: "ok", text: `已创建示例工作区：${nextAppInfo.currentWorkspaceName}` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "创建示例工作区失败。" });
    } finally {
      setIsChangingWorkspace(false);
    }
  }

  async function createNewWorkspace() {
    const workspacePath = await pickWorkspaceDirectory(
      "选择新工作区文件夹",
      "输入新工作区文件夹路径，例如 /Users/me/Documents/Kaoyan Math Bank/My Bank"
    );
    if (!workspacePath?.trim()) return;
    setIsChangingWorkspace(true);
    try {
      await saveBeforeWorkspaceChange();
      const nextAppInfo = await createEmptyWorkspace(workspacePath);
      await reloadWorkspace(nextAppInfo);
      setNotice({ type: "ok", text: `已创建工作区：${nextAppInfo.currentWorkspaceName}` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "创建工作区失败。" });
    } finally {
      setIsChangingWorkspace(false);
    }
  }

  async function openWorkspace() {
    const workspacePath = await pickWorkspaceDirectory(
      "打开已有工作区",
      "输入题库工作区文件夹路径，例如 /Users/me/Documents/Kaoyan Math Bank/My Bank"
    );
    if (!workspacePath?.trim()) return;
    if (workspacePath === appInfo?.currentWorkspacePath) return;
    setIsChangingWorkspace(true);
    try {
      await saveBeforeWorkspaceChange();
      const nextAppInfo = await openExistingWorkspace(workspacePath);
      await reloadWorkspace(nextAppInfo);
      setNotice({ type: "ok", text: `已打开工作区：${nextAppInfo.currentWorkspaceName}` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "打开工作区失败。" });
    } finally {
      setIsChangingWorkspace(false);
    }
  }

  async function switchToWorkspace(workspacePath: string) {
    if (!workspacePath || workspacePath === appInfo?.currentWorkspacePath) return;
    setIsChangingWorkspace(true);
    try {
      await saveBeforeWorkspaceChange();
      const nextAppInfo = await switchWorkspaceRequest(workspacePath);
      await reloadWorkspace(nextAppInfo);
      setNotice({ type: "ok", text: `已切换至：${nextAppInfo.currentWorkspaceName}` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "切换工作区失败。" });
    } finally {
      setIsChangingWorkspace(false);
    }
  }

  async function moveWorkspaceInList(workspacePath: string, direction: "up" | "down") {
    try {
      const nextAppInfo = await moveWorkspace(workspacePath, direction);
      setAppInfo(nextAppInfo);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "移动工作区失败。" });
    }
  }

  async function deleteWorkspace(workspacePath: string) {
    const workspace = appInfo?.recentWorkspaces.find((item) => item.path === workspacePath);
    const name = workspace?.name ?? workspacePath;
    const canTrash = Boolean(window.kmb?.trashPath && workspace?.exists);
    const message = canTrash
      ? `确定要删除工作区“${name}”吗？\n\n工作区文件夹会移到废纸篓/回收站，并从列表移除。`
      : `确定要从列表移除工作区“${name}”吗？\n\n当前环境不能移动文件夹到废纸篓，磁盘文件不会被删除。`;
    if (!window.confirm(message)) return;

    setIsChangingWorkspace(true);
    try {
      if (canTrash && window.kmb?.trashPath) {
        await window.kmb.trashPath(workspacePath);
      }
      const nextAppInfo = await removeWorkspace(workspacePath);
      await reloadWorkspace(nextAppInfo);
      setNotice({ type: "ok", text: canTrash ? `已删除工作区：${name}` : `已移除工作区记录：${name}` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "删除工作区失败。" });
    } finally {
      setIsChangingWorkspace(false);
    }
  }

  async function saveTexPathOverride() {
    try {
      const nextAppInfo = await saveTexPath(texPathDraft);
      setAppInfo(nextAppInfo);
      setNotice({
        type: nextAppInfo.texStatus.available ? "ok" : "error",
        text: nextAppInfo.texStatus.message
      });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "保存 LaTeX 路径失败。" });
    }
  }

  function openCurrentWorkspaceFolder() {
    if (!appInfo?.currentWorkspacePath) return;
    if (window.kmb?.openPath) {
      void window.kmb.openPath(appInfo.currentWorkspacePath);
      return;
    }
    setNotice({ type: "info", text: appInfo.currentWorkspacePath });
  }

  async function uploadAsset(field: TexField, file: File) {
    if (!activeItem) return;
    const { patch } = await uploadQuestionAsset(field, activeItem, file);
    updateItem(activeItem.id, patch);
    setNotice({ type: "ok", text: "图片已插入当前模块。" });
  }

  async function compileCurrentItem() {
    if (!activeItem || !bank) return;
    setIsCompiling(true);
    setCompileResult(null);
    setNotice({ type: "info", text: "正在编译当前题。" });
    try {
      const data = await compileItem(activeItem, bank.settings);
      setCompileResult(data);
      if (!data.ok) {
        setNotice({ type: "error", text: "当前题编译失败，查看日志摘要。" });
        return;
      }
      setNotice({ type: "ok", text: "当前题编译通过。", href: data.pdfUrl });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "当前题编译失败。" });
    } finally {
      setIsCompiling(false);
    }
  }

  async function exportSelected() {
    if (!bank) return;
    if (selectedIds.size === 0) {
      setNotice({ type: "error", text: "请至少勾选一道题目。" });
      return;
    }
    setIsExporting(true);
    setNotice({ type: "info", text: "正在导出四份文件。" });
    try {
      await persistBank(bank);
      const effectiveRandomSeed = exportOrderMode === "random" ? randomSeed.trim() || exportName : undefined;
      const data = (await exportItems({
        itemIds: [...selectedIds],
        fileName: exportName,
        orderMode: exportOrderMode,
        randomSeed: effectiveRandomSeed
      })) as ExportResponse & { error?: string };
      if (!data.ok) {
        setNotice({ type: "error", text: data.error ?? "导出失败，查看编译日志摘要。" });
        setCompileResult(data.results?.questions.ok ? data.results.full : data.results?.questions ?? null);
        return;
      }
      setNotice({ type: "ok", text: `导出完成：${data.files.join("、")}`, href: data.exportUrl });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "导出失败。" });
    } finally {
      setIsExporting(false);
    }
  }

  return {
    appInfo,
    bank,
    activeId,
    activeItem,
    orderedItems,
    filteredItems,
    numberById,
    chapters,
    tags,
    selectedIds,
    chapterFilter,
    tagFilter,
    starFilter,
    search,
    saveState,
    notice,
    exportName,
    exportOrderMode,
    randomSeed,
    isExporting,
    isCompiling,
    compileResult,
    draggingId,
    dropTarget,
    reorderMenu,
    addMenu,
    reorderDialogItem,
    reorderTarget,
    reorderError,
    isChangingWorkspace,
    texPathDraft,
    reorderInputRef,
    setActiveId,
    setChapterFilter,
    setTagFilter,
    setStarFilter,
    setSearch,
    setExportName,
    setExportOrderMode,
    setRandomSeed,
    setTexPathDraft,
    setReorderTarget,
    setReorderError,
    setNotice,
    updateBank,
    updateItem,
    addItem,
    deleteItem,
    deleteActiveItem,
    moveActive,
    openReorderDialog,
    closeReorderDialog,
    submitReorder,
    openReorderMenu,
    openAddMenu,
    startPointerDrag,
    startMouseDrag,
    toggleSelected,
    toggleAllFiltered,
    createSampleWorkspace,
    createNewWorkspace,
    openWorkspace,
    switchToWorkspace,
    moveWorkspaceInList,
    deleteWorkspace,
    saveTexPathOverride,
    openCurrentWorkspaceFolder,
    uploadAsset,
    compileCurrentItem,
    exportSelected
  };
}
