import assert from "node:assert/strict";
import test from "node:test";

import { classify, clampScore, orderCategories, weightedScore } from "./score.js";
import type { CategoryAssessment } from "./schemas.js";

const KEYS = ["skills", "experience", "responsibilities", "seniority", "education"] as const;

function categories(scores: Partial<Record<(typeof KEYS)[number], number>> = {}): CategoryAssessment[] {
  return KEYS.map((criterion) => ({
    criterion,
    score: scores[criterion] ?? 50,
    explanation: "Evidence from the CV.",
    evidence: ["Built internal tools."],
  }));
}

test("weighted score uses the configured weights", () => {
  const score = weightedScore(
    categories({ skills: 100, experience: 80, responsibilities: 50, seniority: 40, education: 20 }),
  );
  assert.equal(score, 71);
  assert.equal(classify(71), "Strong match");
});

test("perfect and empty scores", () => {
  assert.equal(weightedScore(categories({ skills: 100, experience: 100, responsibilities: 100, seniority: 100, education: 100 })), 100);
  assert.equal(weightedScore(categories({ skills: 0, experience: 0, responsibilities: 0, seniority: 0, education: 0 })), 0);
});

test("classification bands", () => {
  assert.equal(classify(100), "Excellent match");
  assert.equal(classify(85), "Excellent match");
  assert.equal(classify(84), "Strong match");
  assert.equal(classify(70), "Strong match");
  assert.equal(classify(69), "Partial match");
  assert.equal(classify(50), "Partial match");
  assert.equal(classify(49), "Weak match");
  assert.equal(classify(30), "Weak match");
  assert.equal(classify(29), "Poor match");
  assert.equal(classify(0), "Poor match");
});

test("scores are clamped before weighting", () => {
  assert.equal(clampScore(140), 100);
  assert.equal(clampScore(-4), 0);
  const ordered = orderCategories(categories({ skills: 140, experience: -5 }));
  assert.equal(ordered.find((item) => item.criterion === "skills")?.score, 100);
  assert.equal(ordered.find((item) => item.criterion === "experience")?.score, 0);
});

test("a missing category is rejected", () => {
  assert.throws(() => weightedScore(categories().slice(0, -1)), /education/);
});
