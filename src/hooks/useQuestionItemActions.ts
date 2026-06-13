import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { DEFAULT_STAR_RATING } from "../constants.js";
import { withOrder } from "../itemOrder.js";
import type { Bank, QuestionItem } from "../../shared/types.js";
import type { AddMode, Notice } from "./controllerTypes.js";

interface QuestionItemActionsOptions {
  activeItem: QuestionItem | null;
  orderedItems: QuestionItem[];
  setActiveId: Dispatch<SetStateAction<string | null>>;
  setNotice: (notice: Notice | null) => void;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  updateBank: (updater: (current: Bank) => Bank) => void;
  clearFilters: () => void;
  closeMenus: () => void;
  workspacePath: string;
}

export function useQuestionItemActions({
  activeItem,
  orderedItems,
  setActiveId,
  setNotice,
  setSelectedIds,
  updateBank,
  clearFilters,
  closeMenus,
  workspacePath
}: QuestionItemActionsOptions) {
  const [deletedItem, setDeletedItem] = useState<{
    item: QuestionItem;
    index: number;
  } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  function clearDeletedUndo() {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setDeletedItem(null);
  }

  useEffect(() => {
    clearDeletedUndo();
    return () => {
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    };
  }, [workspacePath]);

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
    updateBank((current) => ({
      ...current,
      items: nextItems.map((nextItem, index) => withOrder(nextItem, index))
    }));
    setActiveId(item.id);
    setSelectedIds((current) => new Set([...current, item.id]));
    clearFilters();
    closeMenus();
    setNotice({ type: "ok", text: noticeText });
  }

  function deleteItem(id: string) {
    const deletedIndex = orderedItems.findIndex((item) => item.id === id);
    if (deletedIndex === -1) return;
    const item = orderedItems[deletedIndex];
    const label = item.sourceNumber || item.chapter || `第 ${deletedIndex + 1} 题`;
    if (!window.confirm(`确定删除“${label}”吗？\n\n删除后可在 10 秒内撤销。`)) return;
    const remaining = orderedItems
      .filter((candidate) => candidate.id !== id)
      .map((remainingItem, index) => withOrder(remainingItem, index));
    updateBank((current) => ({ ...current, items: remaining }));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setActiveId((currentActiveId) =>
      currentActiveId === id
        ? remaining[Math.min(deletedIndex, remaining.length - 1)]?.id ?? null
        : currentActiveId
    );
    closeMenus();
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

  return {
    addItem,
    deleteItem,
    deleteActiveItem: () => {
      if (activeItem) deleteItem(activeItem.id);
    },
    moveActive,
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
