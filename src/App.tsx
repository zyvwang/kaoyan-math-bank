import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { EditorView } from "@codemirror/view";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckSquare,
  Download,
  ExternalLink,
  FileCheck2,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GripVertical,
  ImagePlus,
  ListOrdered,
  Plus,
  Save,
  Search,
  Settings,
  Square,
  Star,
  Tags,
  Trash2
} from "lucide-react";
import type {
  AppInfo,
  Bank,
  CompileResponse,
  ExportOrderMode,
  ExportResponse,
  QuestionAsset,
  QuestionItem,
  StarRating,
  TexField
} from "./types";
import {
  moveItemToPositionInList,
  reorderItemByDrop,
  withOrder,
  type DropPosition
} from "./itemOrder";
import { nextWheelScrollState, wheelDeltaToPixels } from "./wheelScroll";

const latexExtension = StreamLanguage.define(stex);
const editorScrollPadding = EditorView.theme({
  ".cm-content": {
    paddingTop: "24px",
    paddingBottom: "72px"
  },
  ".cm-scroller": {
    overscrollBehavior: "contain"
  }
});
const STAR_RATINGS: StarRating[] = [1, 2, 3, 4, 5];
const DEFAULT_STAR_RATING: StarRating = 5;
const moduleLabels: Record<TexField, string> = {
  questionTex: "题目",
  solutionTex: "解析",
  noteTex: "备注"
};

type SaveState = "idle" | "saving" | "saved" | "error";
type Notice = { type: "ok" | "error" | "info"; text: string; href?: string };
type ReorderMenu = { id: string; x: number; y: number };
type AddMenu = { x: number; y: number };
type AddMode = { type: "append" } | { type: "insertAfter"; afterId: string };

function App() {
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

  async function loadAppAndBank() {
    const [nextAppInfo, nextBank] = await Promise.all([
      fetchJson<AppInfo>("/api/app"),
      fetchJson<Bank>("/api/bank")
    ]);
    skipNextSave.current = true;
    setAppInfo(nextAppInfo);
    setTexPathDraft(nextAppInfo.appState.texPathOverride ?? "");
    setBank(nextBank);
    setActiveId(nextBank.items[0]?.id ?? null);
    setSelectedIds(new Set(nextBank.items.map((item) => item.id)));
    setCompileResult(null);
  }

  const persistBank = useCallback(async (nextBank: Bank) => {
    setSaveState("saving");
    const response = await fetch("/api/bank", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextBank)
    });
    if (!response.ok) {
      setSaveState("error");
      throw new Error("保存题库失败。");
    }
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
        setNotice({ type: "error", text: error instanceof Error ? error.message : "保存题库失败。" });
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [bank, persistBank]);

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
        reorderItem(draggedId, target.id, target.position);
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

  function reorderItem(draggedId: string, targetId: string, position: DropPosition) {
    const nextItems = reorderItemByDrop(orderedItems, draggedId, targetId, position);
    updateBank((current) => ({ ...current, items: nextItems }));
    setActiveId(draggedId);
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
    const nextBank = await fetchJson<Bank>("/api/bank");
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
      const nextAppInfo = await postJson<AppInfo>("/api/workspaces/create-sample", { workspacePath });
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
      const nextAppInfo = await postJson<AppInfo>("/api/workspaces/create-empty", { workspacePath });
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
      const nextAppInfo = await postJson<AppInfo>("/api/workspaces/open", { workspacePath });
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
      const nextAppInfo = await postJson<AppInfo>("/api/workspaces/switch", { workspacePath });
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
      const nextAppInfo = await postJson<AppInfo>("/api/workspaces/move", { workspacePath, direction });
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
      const nextAppInfo = await postJson<AppInfo>("/api/workspaces/remove", { workspacePath });
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
      const nextAppInfo = await postJson<AppInfo>("/api/tex-path", { texPath: texPathDraft });
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
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/assets", { method: "POST", body: formData });
    const data = (await response.json()) as { asset?: QuestionAsset; insertText?: string; error?: string };
    if (!response.ok || !data.asset || !data.insertText) {
      throw new Error(data.error ?? "图片上传失败。");
    }

    updateItem(activeItem.id, {
      assets: [...activeItem.assets, data.asset],
      [field]: appendTex(activeItem[field], data.insertText)
    });
    setNotice({ type: "ok", text: "图片已插入当前模块。" });
  }

  async function compileCurrentItem() {
    if (!activeItem || !bank) return;
    setIsCompiling(true);
    setCompileResult(null);
    setNotice({ type: "info", text: "正在编译当前题。" });
    try {
      const response = await fetch("/api/compile-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: activeItem, settings: bank.settings })
      });
      const data = (await response.json()) as CompileResponse & { error?: string };
      setCompileResult(data);
      if (!response.ok || !data.ok) {
        setNotice({ type: "error", text: data.error ?? "当前题编译失败，查看日志摘要。" });
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
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: [...selectedIds],
          fileName: exportName,
          orderMode: exportOrderMode,
          randomSeed: effectiveRandomSeed
        })
      });
      const data = (await response.json()) as ExportResponse & { error?: string };
      if (!response.ok || !data.ok) {
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

  if (!bank || !appInfo) {
    return (
      <main className="loadingScreen">
        <div className="loadingMark">考研数学一题库</div>
      </main>
    );
  }

  if (appInfo.setupRequired) {
    return (
      <main className="setupShell">
        <section className="setupPanel">
          <div className="setupCopy">
            <span>Kaoyan Math Bank</span>
            <h1>选择第一个题库工作区</h1>
            <p>工作区是一个普通文件夹，里面会保存 bank.json、图片、导出文件和临时编译文件。</p>
          </div>
          <div className="setupActions">
            <button className="primaryAction" onClick={createSampleWorkspace} disabled={isChangingWorkspace}>
              <FolderPlus size={18} />
              创建示例工作区
            </button>
            <button className="secondaryAction" onClick={openWorkspace} disabled={isChangingWorkspace}>
              <FolderInput size={18} />
              打开已有工作区
            </button>
          </div>
          {notice && <p className={`setupNotice ${notice.type}`}>{notice.text}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <header className="brandBar">
          <div>
            <h1>Kaoyan Math Bank</h1>
            <p>{orderedItems.length} 题 · 已选 {selectedIds.size}</p>
          </div>
          <button className="iconButton primary" onClick={openAddMenu} title="新增题目">
            <Plus size={18} />
          </button>
        </header>

        <section className="workspacePanel">
          <div className="workspaceTitle">
            <span>工作区</span>
            <strong title={appInfo.currentWorkspacePath}>{appInfo.currentWorkspaceName}</strong>
          </div>
          <div className="workspaceActions">
            <button
              className="workspaceActionButton"
              onClick={createNewWorkspace}
              disabled={isChangingWorkspace}
              title="新建空工作区"
            >
              <FolderPlus size={16} />
              新建
            </button>
            <button
              className="workspaceActionButton"
              onClick={openWorkspace}
              disabled={isChangingWorkspace}
              title="打开已有工作区"
            >
              <FolderInput size={16} />
              打开
            </button>
            <button
              className="workspaceActionButton"
              onClick={openCurrentWorkspaceFolder}
              disabled={!appInfo.currentWorkspacePath}
              title="在 Finder 或文件管理器中显示当前工作区"
            >
              <ExternalLink size={16} />
              显示
            </button>
          </div>
          <div className="workspaceList">
            {appInfo.recentWorkspaces.map((workspace, index) => (
              <div
                className={[
                  "workspaceListItem",
                  workspace.path === appInfo.currentWorkspacePath ? "active" : "",
                  workspace.exists ? "" : "missing"
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={workspace.path}
              >
                <button
                  className="workspaceListMain"
                  type="button"
                  onClick={() => void switchToWorkspace(workspace.path)}
                  disabled={isChangingWorkspace || workspace.path === appInfo.currentWorkspacePath}
                  title={workspace.path}
                >
                  <strong>{workspace.name}</strong>
                  <small>{workspace.exists ? "本地工作区" : "路径缺失"}</small>
                </button>
                <div className="workspaceListControls">
                  <button
                    className="miniIconButton"
                    type="button"
                    onClick={() => void moveWorkspaceInList(workspace.path, "up")}
                    disabled={index === 0 || isChangingWorkspace}
                    title="上移工作区"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="miniIconButton"
                    type="button"
                    onClick={() => void moveWorkspaceInList(workspace.path, "down")}
                    disabled={index === appInfo.recentWorkspaces.length - 1 || isChangingWorkspace}
                    title="下移工作区"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    className="miniIconButton danger"
                    type="button"
                    onClick={() => void deleteWorkspace(workspace.path)}
                    disabled={isChangingWorkspace}
                    title="删除工作区"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`texStatus ${appInfo.texStatus.available ? "ok" : "missing"}`}
            title={appInfo.texStatus.message}
            onClick={() => setNotice({ type: appInfo.texStatus.available ? "ok" : "error", text: appInfo.texStatus.message })}
          >
            {appInfo.texStatus.available ? <FileCheck2 size={15} /> : <AlertTriangle size={15} />}
            {appInfo.texStatus.available ? "TeX 可用" : "未检测到 TeX"}
          </button>
        </section>

        <div className="filterStack">
          <label className="searchBox">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索" />
          </label>
          <div className="filterRow">
            <label>
              <FolderOpen size={15} />
              <select value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)}>
                <option value="">全部章节</option>
                {chapters.map((chapter) => (
                  <option key={chapter} value={chapter}>
                    {chapter}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <Tags size={15} />
              <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                <option value="">全部标签</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <Star size={15} />
              <select value={starFilter} onChange={(event) => setStarFilter(event.target.value)}>
                <option value="">全部星级</option>
                {STAR_RATINGS.map((rating) => (
                  <option key={rating} value={rating}>
                    {renderStars(rating)} {rating}星
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="selectFiltered" onClick={toggleAllFiltered}>
            {filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id)) ? (
              <CheckSquare size={16} />
            ) : (
              <Square size={16} />
            )}
            当前列表
          </button>
        </div>

        <div className="questionList">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              className={[
                "questionListItem",
                activeItem?.id === item.id ? "active" : "",
                draggingId === item.id ? "dragging" : "",
                dropTarget?.id === item.id ? `drop-${dropTarget.position}` : ""
              ]
                .filter(Boolean)
                .join(" ")}
              data-question-id={item.id}
              onClick={() => setActiveId(item.id)}
              onContextMenu={(event) => openReorderMenu(event, item.id)}
            >
              <span className="checkHit" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  aria-label="选择导出"
                />
              </span>
              <span
                className="dragHandle"
                title="拖拽排序"
                onMouseDown={(event) => startMouseDrag(event, item.id)}
                onPointerDown={(event) => startPointerDrag(event, item.id)}
              >
                <GripVertical size={16} />
              </span>
              <span className="questionIndex">{numberById.get(item.id)}</span>
              <span className="questionMeta">
                <strong>{item.sourceNumber || item.chapter || "未命名题目"}</strong>
                <small>
                  <span className="starText">{renderStars(item.star)}</span>
                  {item.tags.length ? ` · ${item.tags.join(" / ")}` : ` · ${item.chapter || "未分类"}`}
                </small>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="workspace">
        <header className="topBar">
          <div className="statusCluster">
            <span className={`savePill ${saveState}`}>
              {saveState === "saving" ? <Save size={15} /> : saveState === "error" ? <AlertTriangle size={15} /> : <Check size={15} />}
              {saveState === "saving" ? "保存中" : saveState === "error" ? "保存失败" : "已保存"}
            </span>
            {notice && (
              <a className={`notice ${notice.type}`} href={notice.href} target="_blank" rel="noreferrer">
                {notice.type === "error" ? <AlertTriangle size={15} /> : <Check size={15} />}
                <span>{notice.text}</span>
              </a>
            )}
          </div>
          <div className="toolbar">
            <button className="iconButton" onClick={() => moveActive(-1)} title="上移">
              <ArrowUp size={18} />
            </button>
            <button className="iconButton" onClick={() => moveActive(1)} title="下移">
              <ArrowDown size={18} />
            </button>
            <button className="iconButton" onClick={() => activeItem && openReorderDialog(activeItem.id)} disabled={!activeItem} title="更改题序">
              <ListOrdered size={18} />
            </button>
            <button className="iconButton danger" onClick={deleteActiveItem} title="删除题目">
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        {activeItem ? (
          <>
            <section className="metaStrip">
              <label>
                <span>原编号</span>
                <input
                  value={activeItem.sourceNumber ?? ""}
                  onChange={(event) => updateItem(activeItem.id, { sourceNumber: event.target.value })}
                />
              </label>
              <label>
                <span>章节</span>
                <input
                  value={activeItem.chapter}
                  onChange={(event) => updateItem(activeItem.id, { chapter: event.target.value })}
                  placeholder="高等数学/一元函数微分学"
                />
              </label>
              <label>
                <span>标签</span>
                <input
                  value={activeItem.tags.join(", ")}
                  onChange={(event) => updateItem(activeItem.id, { tags: parseTags(event.target.value) })}
                  placeholder="极限, 洛必达"
                />
              </label>
              <label>
                <span>星级</span>
                <select
                  value={activeItem.star}
                  onChange={(event) => updateItem(activeItem.id, { star: asStarRating(event.target.value) })}
                >
                  {STAR_RATINGS.map((rating) => (
                    <option key={rating} value={rating}>
                      {renderStars(rating)} {rating}星
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <details className="settingsBand">
              <summary>
                <Settings size={16} />
                全局 LaTeX
              </summary>
              <div className="settingsGrid">
                <label>
                  <span>题间距</span>
                  <input
                    value={bank.settings.spacing.item}
                    onChange={(event) =>
                      updateBank((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          spacing: { ...current.settings.spacing, item: event.target.value }
                        }
                      }))
                    }
                  />
                </label>
                <label>
                  <span>模块间距</span>
                  <input
                    value={bank.settings.spacing.module}
                    onChange={(event) =>
                      updateBank((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          spacing: { ...current.settings.spacing, module: event.target.value }
                        }
                      }))
                    }
                  />
                </label>
                <label className="preambleField">
                  <span>导言区</span>
                  <textarea
                    value={bank.settings.preamble}
                    onChange={(event) =>
                      updateBank((current) => ({
                        ...current,
                        settings: { ...current.settings, preamble: event.target.value }
                      }))
                    }
                    spellCheck={false}
                  />
                </label>
                <label className="texPathField">
                  <span>latexmk 路径</span>
                  <input
                    value={texPathDraft}
                    onChange={(event) => setTexPathDraft(event.target.value)}
                    onBlur={() => void saveTexPathOverride()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder="留空自动检测"
                  />
                </label>
              </div>
            </details>

            <section className="moduleStack">
              {(["questionTex", "solutionTex", "noteTex"] as TexField[]).map((field) => (
                <ModuleEditor
                  key={field}
                  field={field}
                  value={activeItem[field]}
                  item={activeItem}
                  onChange={(value) => updateItem(activeItem.id, { [field]: value })}
                  onUpload={(file) => uploadAsset(field, file)}
                />
              ))}
            </section>
          </>
        ) : (
          <section className="emptyState">
            <p>暂无题目</p>
            <button onClick={() => addItem({ type: "append" })}>
              <Plus size={16} />
              新增题目
            </button>
          </section>
        )}

        <footer className="exportDock">
          <div className="compileBlock">
            <button onClick={compileCurrentItem} disabled={!activeItem || isCompiling}>
              <FileCheck2 size={17} />
              {isCompiling ? "编译中" : "检查当前题"}
            </button>
            {compileResult && !compileResult.ok && <pre className="logBox">{compileResult.log}</pre>}
          </div>
          <div className="exportBlock">
            <label className="exportNameField">
              <span>导出名</span>
              <input value={exportName} onChange={(event) => setExportName(event.target.value)} />
            </label>
            <label className="exportOrderField">
              <span>顺序</span>
              <select
                value={exportOrderMode}
                onChange={(event) => setExportOrderMode(event.target.value as ExportOrderMode)}
              >
                <option value="normal">正常顺序</option>
                <option value="random">随机顺序</option>
              </select>
            </label>
            {exportOrderMode === "random" && (
              <label className="exportSeedField">
                <span>种子</span>
                <input
                  value={randomSeed}
                  onChange={(event) => setRandomSeed(event.target.value)}
                  placeholder="留空则使用导出名"
                />
              </label>
            )}
            <button className="primaryAction" onClick={exportSelected} disabled={selectedIds.size === 0 || isExporting}>
              <Download size={17} />
              {isExporting ? "导出中" : `导出 ${selectedIds.size} 题`}
            </button>
          </div>
        </footer>
      </section>

      {reorderMenu && (
        <div className="contextMenu" style={{ left: reorderMenu.x, top: reorderMenu.y }}>
          <button type="button" onClick={() => addItem({ type: "insertAfter", afterId: reorderMenu.id })}>
            <Plus size={16} />
            在此题后插入
          </button>
          <button type="button" onClick={() => openReorderDialog(reorderMenu.id)}>
            <ListOrdered size={16} />
            更改题序至...
          </button>
          <button className="danger" type="button" onClick={() => deleteItem(reorderMenu.id)}>
            <Trash2 size={16} />
            删除
          </button>
        </div>
      )}

      {addMenu && (
        <div className="contextMenu" style={{ left: addMenu.x, top: addMenu.y }}>
          {activeItem && (
            <button type="button" onClick={() => addItem({ type: "insertAfter", afterId: activeItem.id })}>
              <Plus size={16} />
              在当前题后插入
            </button>
          )}
          <button type="button" onClick={() => addItem({ type: "append" })}>
            <Plus size={16} />
            追加到末尾
          </button>
        </div>
      )}

      {reorderDialogItem && (
        <div
          className="modalBackdrop"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReorderDialog();
          }}
        >
          <form
            className="reorderDialog"
            noValidate
            onSubmit={submitReorder}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeReorderDialog();
              }
            }}
          >
            <header>
              <h2>更改题序</h2>
              <span>
                当前第 {numberById.get(reorderDialogItem.id)} 题 / 共 {orderedItems.length} 题
              </span>
            </header>
            <label>
              <span>目标题序</span>
              <input
                ref={reorderInputRef}
                type="text"
                value={reorderTarget}
                inputMode="numeric"
                onChange={(event) => {
                  setReorderTarget(event.target.value);
                  setReorderError("");
                }}
              />
            </label>
            {reorderError && <p className="reorderError">{reorderError}</p>}
            <footer>
              <button type="button" className="secondaryAction" onClick={closeReorderDialog}>
                取消
              </button>
              <button type="submit" className="primaryAction">
                确认
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}

interface ModuleEditorProps {
  field: TexField;
  value: string;
  item: QuestionItem;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
}

function ModuleEditor({ field, value, item, onChange, onUpload }: ModuleEditorProps) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const editorPaneRef = useRef<HTMLDivElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const root = editorPaneRef.current;
    if (!root) return undefined;
    return bindWheelScroller(root, () => root.querySelector<HTMLElement>(".cm-scroller"));
  }, []);

  async function handleFile(file?: File) {
    if (!file) return;
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <article className="modulePanel">
      <header>
        <h2>{moduleLabels[field]}</h2>
        <button className="iconButton" onClick={() => fileInput.current?.click()} title="插入图片">
          <ImagePlus size={17} />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        {isUploading && <span className="miniStatus">上传中</span>}
      </header>
      <div className="moduleGrid">
        <div className="editorPane" ref={editorPaneRef}>
          <CodeMirror
            value={value}
            height="100%"
            basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
            extensions={[latexExtension, EditorView.lineWrapping, editorScrollPadding]}
            onChange={onChange}
          />
        </div>
        <LatexPreview tex={value} assets={item.assets} />
      </div>
    </article>
  );
}

function LatexPreview({ tex, assets }: { tex: string; assets: QuestionAsset[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const parts = useMemo(() => splitLatexImages(tex, assets), [assets, tex]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    return bindWheelScroller(root, () => root);
  }, []);

  useEffect(() => {
    let cancelled = false;
    ensureMathJax()
      .then(() => {
        if (!cancelled && ref.current && window.MathJax?.typesetPromise) {
          return window.MathJax.typesetPromise([ref.current]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tex]);

  return (
    <div className="previewPane" ref={ref}>
      {parts.length === 0 ? (
        <span className="emptyPreview">空</span>
      ) : (
        parts.map((part, index) =>
          part.type === "image" ? (
            <figure className="previewImage" key={`${part.src}-${index}`}>
              <img src={part.src} alt={part.alt} />
            </figure>
          ) : (
            <div className="latexText" key={index}>
              {part.text}
            </div>
          )
        )
      )}
      {/(\\begin\{tikzpicture}|\\begin\{axis})/.test(tex) && (
        <div className="tikzNotice">
          <AlertTriangle size={14} />
          TikZ/pgfplots 以真实编译为准
        </div>
      )}
    </div>
  );
}

function bindWheelScroller(root: HTMLElement, getTarget: () => HTMLElement | null) {
  const handleWheel = (event: WheelEvent) => scrollElementFromWheelEvent(root, event, getTarget());
  root.addEventListener("wheel", handleWheel, { capture: true, passive: false });
  return () => root.removeEventListener("wheel", handleWheel, { capture: true });
}

function scrollElementFromWheelEvent(root: HTMLElement, event: WheelEvent, target: HTMLElement | null) {
  if (!target || event.ctrlKey) return;

  const { deltaX, deltaY } = wheelDeltaToPixels(
    event.deltaX,
    event.deltaY,
    event.deltaMode,
    root.clientWidth,
    root.clientHeight
  );
  const next = nextWheelScrollState({
    scrollTop: target.scrollTop,
    scrollLeft: target.scrollLeft,
    scrollHeight: target.scrollHeight,
    scrollWidth: target.scrollWidth,
    clientHeight: target.clientHeight,
    clientWidth: target.clientWidth,
    deltaX,
    deltaY
  });

  if (!next.changed) return;
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
  target.scrollTop = next.scrollTop;
  target.scrollLeft = next.scrollLeft;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "请求失败。");
  }
  return data;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "请求失败。");
  }
  return data;
}

function parseTags(input: string): string[] {
  return [...new Set(input.split(/[,\n，]/).map((tag) => tag.trim()).filter(Boolean))];
}

function asStarRating(input: string | number): StarRating {
  const rating = Number(input);
  return STAR_RATINGS.includes(rating as StarRating) ? (rating as StarRating) : DEFAULT_STAR_RATING;
}

function renderStars(rating: StarRating): string {
  return "★".repeat(rating);
}

function appendTex(current: string, addition: string): string {
  return [current.trimEnd(), addition].filter(Boolean).join("\n\n");
}

function splitLatexImages(tex: string, assets: QuestionAsset[]) {
  const parts: Array<{ type: "text"; text: string } | { type: "image"; src: string; alt: string }> = [];
  const assetByPath = new Map(assets.map((asset) => [asset.relativePath, asset]));
  const pattern = /\\includegraphics(?:\[[^\]]*])?\{([^}]+)}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tex))) {
    const before = tex.slice(lastIndex, match.index).replace(/\\begin\{center}|\\end\{center}/g, "").trim();
    if (before) parts.push({ type: "text", text: before });
    const imagePath = match[1];
    const asset = assetByPath.get(imagePath);
    parts.push({
      type: "image",
      src: asset ? `/assets/${asset.fileName}` : `/${imagePath}`,
      alt: asset?.originalName ?? imagePath
    });
    lastIndex = pattern.lastIndex;
  }
  const rest = tex.slice(lastIndex).replace(/\\begin\{center}|\\end\{center}/g, "").trim();
  if (rest) parts.push({ type: "text", text: rest });
  return parts;
}

let mathJaxPromise: Promise<void> | null = null;

function ensureMathJax(): Promise<void> {
  if (window.MathJax?.typesetPromise) return Promise.resolve();
  if (mathJaxPromise) return mathJaxPromise;

  window.MathJax = {
    tex: {
      inlineMath: [
        ["$", "$"],
        ["\\(", "\\)"]
      ],
      displayMath: [
        ["$$", "$$"],
        ["\\[", "\\]"]
      ],
      processEscapes: true
    },
    options: {
      skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
    }
  };

  mathJaxPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/mathjax/tex-mml-chtml.js";
    script.async = true;
    script.onload = () => {
      window.MathJax?.startup?.promise?.then(resolve).catch(reject) ?? resolve();
    };
    script.onerror = () => reject(new Error("MathJax 加载失败。"));
    document.head.appendChild(script);
  });

  return mathJaxPromise;
}

declare global {
  interface Window {
    kmb?: {
      platform: string;
      selectWorkspaceDirectory: (title?: string) => Promise<string | null>;
      openPath: (targetPath: string) => Promise<string>;
      trashPath: (targetPath: string) => Promise<boolean>;
    };
    MathJax?: {
      tex?: unknown;
      options?: unknown;
      startup?: { promise?: Promise<void> };
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
    };
  }
}

export default App;
