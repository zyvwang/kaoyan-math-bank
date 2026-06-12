import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Dispatch,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  SetStateAction
} from "react";
import { DEFAULT_STAR_RATING } from "../constants.js";
import {
  moveItemToPositionInList,
  reorderItemByDrop,
  withOrder,
  type DropPosition
} from "../itemOrder.js";
import type { Bank, QuestionItem } from "../../shared/types.js";
import type { AddMenu, AddMode, DropTarget, Notice, ReorderMenu } from "./controllerTypes.js";

interface QuestionReorderOptions {
  activeItem: QuestionItem | null;
  numberById: Map<string, number>;
  orderedItems: QuestionItem[];
  setActiveId: (id: string | null | ((current: string | null) => string | null)) => void;
  setNotice: (notice: Notice | null) => void;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  updateBank: (updater: (current: Bank) => Bank) => void;
  clearFilters: () => void;
  workspacePath: string;
}

export function useQuestionReorder({
  activeItem,
  numberById,
  orderedItems,
  setActiveId,
  setNotice,
  setSelectedIds,
  updateBank,
  clearFilters,
  workspacePath
}: QuestionReorderOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [reorderMenu, setReorderMenu] = useState<ReorderMenu | null>(null);
  const [addMenu, setAddMenu] = useState<AddMenu | null>(null);
  const [reorderDialogId, setReorderDialogId] = useState<string | null>(null);
  const [reorderTarget, setReorderTarget] = useState("");
  const [reorderError, setReorderError] = useState("");
  const draggingIdRef = useRef<string | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const reorderInputRef = useRef<HTMLInputElement | null>(null);
  const [deletedItem, setDeletedItem] = useState<{ item: QuestionItem; index: number } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  function clearDeletedUndo() {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setDeletedItem(null);
  }

  useEffect(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setDeletedItem(null);
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, [workspacePath]);

  const reorderDialogItem = useMemo(() => {
    return orderedItems.find((item) => item.id === reorderDialogId) ?? null;
  }, [orderedItems, reorderDialogId]);

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
    function setCurrentDropTarget(next: DropTarget | null) {
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
  }, [orderedItems, setActiveId, updateBank]);

  function addItem(mode: AddMode = { type: "append" }) {
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

    const item = createQuestionItem(orderedItems.length, inheritedChapter);
    const nextItems = [...orderedItems];
    nextItems.splice(insertIndex, 0, item);
    updateBank((current) => ({ ...current, items: nextItems.map((nextItem, index) => withOrder(nextItem, index)) }));
    setActiveId(item.id);
    setSelectedIds((current) => new Set([...current, item.id]));
    clearFilters();
    setAddMenu(null);
    setReorderMenu(null);
    setNotice({ type: "ok", text: noticeText });
  }

  function deleteItem(id: string) {
    const deletedIndex = orderedItems.findIndex((item) => item.id === id);
    if (deletedIndex === -1) return;
    const item = orderedItems[deletedIndex];
    const label = item.sourceNumber || item.chapter || `第 ${deletedIndex + 1} 题`;
    if (!window.confirm(`确定删除“${label}”吗？\n\n删除后可在 10 秒内撤销。`)) return;
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
    clearDeletedUndo();
    setDeletedItem({ item, index: deletedIndex });
    undoTimerRef.current = window.setTimeout(clearDeletedUndo, 10_000);
    setNotice({ type: "info", text: "题目已删除，可在 10 秒内撤销。" });
  }

  function undoDelete() {
    if (!deletedItem) return;
    updateBank((current) => {
      if (current.items.some((item) => item.id === deletedItem.item.id)) return current;
      const nextItems = [...current.items].sort((a, b) => a.order - b.order);
      nextItems.splice(Math.min(deletedItem.index, nextItems.length), 0, deletedItem.item);
      return {
        ...current,
        items: nextItems.map((item, index) => withOrder(item, index))
      };
    });
    setSelectedIds((current) => new Set([...current, deletedItem.item.id]));
    setActiveId(deletedItem.item.id);
    clearDeletedUndo();
    setNotice({ type: "ok", text: "已撤销删除。" });
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
      items: items.map((item, itemIndex) => withOrder(item, itemIndex))
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

    const nextItems = moveItemToPositionInList(orderedItems, reorderDialogItem.id, targetNumber);
    updateBank((current) => ({ ...current, items: nextItems }));
    setActiveId(reorderDialogItem.id);
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

  return {
    draggingId,
    dropTarget,
    reorderMenu,
    addMenu,
    reorderDialogItem,
    reorderTarget,
    reorderError,
    reorderInputRef,
    setReorderTarget,
    setReorderError,
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
    canUndoDelete: Boolean(deletedItem),
    undoDelete
  };
}

function createQuestionItem(currentLength: number, chapter = ""): QuestionItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    order: currentLength + 1,
    sourceNumber: "",
    chapter,
    tags: [],
    star: DEFAULT_STAR_RATING,
    modules: {
      question: { tex: "" },
      solution: { tex: "" },
      note: { tex: "" }
    },
    assets: [],
    createdAt: now,
    updatedAt: now
  };
}
