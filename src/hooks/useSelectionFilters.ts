import { useCallback, useState } from "react";
import type { QuestionItem } from "../../shared/types.js";

export function useSelectionFilters() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [chapterFilter, setChapterFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [starFilter, setStarFilter] = useState("");
  const [search, setSearch] = useState("");

  const clearFilters = useCallback(() => {
    setChapterFilter("");
    setTagFilter("");
    setStarFilter("");
    setSearch("");
  }, []);

  const selectAllItems = useCallback((items: QuestionItem[]) => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, []);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered(filteredItems: QuestionItem[]) {
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

  return {
    selectedIds,
    setSelectedIds,
    chapterFilter,
    tagFilter,
    starFilter,
    search,
    setChapterFilter,
    setTagFilter,
    setStarFilter,
    setSearch,
    clearFilters,
    selectAllItems,
    toggleSelected,
    toggleAllFiltered
  };
}
