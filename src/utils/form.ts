import { DEFAULT_STAR_RATING, STAR_RATINGS } from "../constants.js";
import type { StarRating } from "../../shared/types.js";

export function parseTags(input: string): string[] {
  return [...new Set(input.split(/[,\n，]/).map((tag) => tag.trim()).filter(Boolean))];
}

export function asStarRating(input: string | number): StarRating {
  const rating = Number(input);
  return STAR_RATINGS.includes(rating as StarRating) ? (rating as StarRating) : DEFAULT_STAR_RATING;
}

export function renderStars(rating: StarRating): string {
  return "★".repeat(rating);
}

export function appendTex(current: string, addition: string): string {
  return [current.trimEnd(), addition].filter(Boolean).join("\n\n");
}
