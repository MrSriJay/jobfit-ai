import { CRITERIA, WEIGHTS, type Criterion } from "./config.js";
import { AppError } from "./errors.js";
import type { CategoryAssessment } from "./schemas.js";

export function clampScore(value: number): number {
  const score = Math.trunc(value);
  return Math.max(0, Math.min(100, score));
}

export function orderCategories(categories: CategoryAssessment[]): CategoryAssessment[] {
  const found = new Map<Criterion, CategoryAssessment>();
  for (const category of categories) {
    if (!found.has(category.criterion)) found.set(category.criterion, category);
  }
  const missing = CRITERIA.filter((item) => !found.has(item.key)).map((item) => item.key);
  if (missing.length > 0) {
    throw new AppError(`The assessment is missing a score for: ${missing.join(", ")}.`);
  }
  return CRITERIA.map((item) => {
    const category = found.get(item.key);
    if (!category) throw new AppError(`The assessment is missing a score for: ${item.key}.`);
    return { ...category, score: clampScore(category.score) };
  });
}

export function weightedScore(categories: CategoryAssessment[]): number {
  const ordered = orderCategories(categories);
  const total = ordered.reduce((sum, category) => sum + category.score * WEIGHTS[category.criterion], 0);
  return Math.trunc(total + 0.5);
}

export function classify(score: number): string {
  const value = clampScore(score);
  if (value >= 85) return "Excellent match";
  if (value >= 70) return "Strong match";
  if (value >= 50) return "Partial match";
  if (value >= 30) return "Weak match";
  return "Poor match";
}
