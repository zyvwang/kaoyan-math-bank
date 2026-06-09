import type { StarRating, TexField } from "../shared/types.js";

export const STAR_RATINGS: StarRating[] = [1, 2, 3, 4, 5];
export const DEFAULT_STAR_RATING: StarRating = 5;

export const moduleLabels: Record<TexField, string> = {
  questionTex: "题目",
  solutionTex: "解析",
  noteTex: "备注"
};
