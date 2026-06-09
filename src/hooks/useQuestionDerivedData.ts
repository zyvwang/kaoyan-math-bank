import { useMemo } from "react";
import type { Bank, QuestionItem } from "../../shared/types.js";

export interface QuestionFilters {
  chapterFilter: string;
  tagFilter: string;
  starFilter: string;
  search: string;
}

export function useQuestionDerivedData(bank: Bank | null, activeId: string | null, filters: QuestionFilters) {
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
    const term = filters.search.trim().toLowerCase();
    return orderedItems.filter((item) => matchesFilters(item, term, filters));
  }, [filters, orderedItems]);

  const activeItem = useMemo(() => {
    return orderedItems.find((item) => item.id === activeId) ?? orderedItems[0] ?? null;
  }, [activeId, orderedItems]);

  return {
    orderedItems,
    filteredItems,
    numberById,
    chapters,
    tags,
    activeItem
  };
}

function matchesFilters(item: QuestionItem, term: string, filters: QuestionFilters): boolean {
  const matchesChapter = !filters.chapterFilter || item.chapter === filters.chapterFilter;
  const matchesTag = !filters.tagFilter || item.tags.includes(filters.tagFilter);
  const matchesStar = !filters.starFilter || item.star === Number(filters.starFilter);
  const haystack = [
    item.sourceNumber,
    item.chapter,
    `${item.star}星`,
    item.tags.join(" "),
    item.modules.question.tex,
    item.modules.solution.tex,
    item.modules.note.tex
  ]
    .join(" ")
    .toLowerCase();
  return matchesChapter && matchesTag && matchesStar && (!term || haystack.includes(term));
}
