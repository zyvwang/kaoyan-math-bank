import type { QuestionItem } from "./types.js";

export type DropPosition = "before" | "after";

export function withOrder(item: QuestionItem, index: number, updatedAt = new Date().toISOString()): QuestionItem {
  return { ...item, order: index + 1, updatedAt };
}

export function moveItemToPositionInList(
  items: QuestionItem[],
  id: string,
  targetNumber: number,
  updatedAt = new Date().toISOString()
): QuestionItem[] {
  const movedItem = items.find((item) => item.id === id);
  if (!movedItem) return items;
  if (targetNumber < 1 || targetNumber > items.length) return items;
  const nextItems = items.filter((item) => item.id !== id);
  nextItems.splice(targetNumber - 1, 0, movedItem);
  return nextItems.map((item, index) => withOrder(item, index, updatedAt));
}

export function reorderItemByDrop(
  items: QuestionItem[],
  draggedId: string,
  targetId: string,
  position: DropPosition,
  updatedAt = new Date().toISOString()
): QuestionItem[] {
  if (draggedId === targetId) return items;
  const dragged = items.find((item) => item.id === draggedId);
  if (!dragged) return items;

  const withoutDragged = items.filter((item) => item.id !== draggedId);
  const targetIndex = withoutDragged.findIndex((item) => item.id === targetId);
  if (targetIndex === -1) return items;

  const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
  withoutDragged.splice(insertIndex, 0, dragged);
  return withoutDragged.map((item, index) => withOrder(item, index, updatedAt));
}
