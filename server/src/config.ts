import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, "../..");

dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
const requestedEffort = (process.env.OPENAI_REASONING_EFFORT ?? "low").trim().toLowerCase();

export const MODEL = (process.env.OPENAI_MODEL ?? "gpt-5.6-sol").trim() || "gpt-5.6-sol";
export const REASONING_EFFORT = EFFORTS.has(requestedEffort) ? requestedEffort : "low";
export const MAX_CV_CHARS = 80_000;
export const MAX_JOB_CHARS = 40_000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const PORT = Number(process.env.PORT ?? 8787);

export const CRITERIA = [
  { key: "skills", label: "Technical and professional skills", weight: 0.35 },
  { key: "experience", label: "Relevant work experience", weight: 0.25 },
  { key: "responsibilities", label: "Responsibilities and role alignment", weight: 0.2 },
  { key: "seniority", label: "Seniority and experience level", weight: 0.1 },
  { key: "education", label: "Education and certifications", weight: 0.1 },
] as const;

export type Criterion = (typeof CRITERIA)[number]["key"];

export const WEIGHTS: Record<Criterion, number> = {
  skills: 0.35,
  experience: 0.25,
  responsibilities: 0.2,
  seniority: 0.1,
  education: 0.1,
};
