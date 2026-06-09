import type { ModuleKind, StarRating } from "../shared/types.js";

export const STAR_RATINGS: StarRating[] = [1, 2, 3, 4, 5];
export const DEFAULT_STAR_RATING: StarRating = 5;
export const MODULE_KINDS: ModuleKind[] = ["question", "solution", "note"];

export const moduleLabels: Record<ModuleKind, string> = {
  question: "题目",
  solution: "解析",
  note: "备注"
};
