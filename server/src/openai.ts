import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

import { MAX_CV_CHARS, MAX_JOB_CHARS, MODEL, REASONING_EFFORT, ROOT } from "./config.js";
import { AppError, publicErrorText } from "./errors.js";
import { classify, orderCategories, weightedScore } from "./score.js";
import {
  candidateProfileSchema,
  emailDraftSchema,
  matchResultSchema,
  type AnalysisRecord,
  type CandidateProfile,
  type EmailDraft,
  type JobPosting,
  type MatchResult,
} from "./schemas.js";

const promptCache = new Map<string, string>();
const profileCache = new Map<string, CandidateProfile>();

function loadPrompt(filename: string): string {
  const cached = promptCache.get(filename);
  if (cached) return cached;
  const text = readFileSync(path.join(ROOT, "prompts", filename), "utf8").trim();
  promptCache.set(filename, text);
  return text;
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!key) {
    throw new AppError("Add OPENAI_API_KEY to the .env file in the project folder, then restart the server.", 503);
  }
  return key;
}

export function apiKeyConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function rememberProfile(hash: string, profile: CandidateProfile): void {
  if (profileCache.has(hash)) profileCache.delete(hash);
  profileCache.set(hash, profile);
  while (profileCache.size > 8) {
    const oldest = profileCache.keys().next().value;
    if (!oldest) break;
    profileCache.delete(oldest);
  }
}

async function parseStructured<T>(instructions: string, userInput: string, schema: ZodType<T>, name: string): Promise<T> {
  const client = new OpenAI({ apiKey: apiKey(), timeout: 180_000 });
  try {
    const response = await client.responses.parse({
      model: MODEL,
      instructions,
      input: userInput,
      text: { format: zodTextFormat(schema, name) },
      reasoning: { effort: REASONING_EFFORT as "low" },
      store: false,
    });
    if (!response.output_parsed) {
      throw new AppError("The model did not return a usable result. Try again.", 502);
    }
    return response.output_parsed;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(publicErrorText(error), 502);
  }
}

export async function extractProfile(cvText: string): Promise<{ profile: CandidateProfile; truncated: boolean; fromCache: boolean }> {
  const clipped = cvText.trim().slice(0, MAX_CV_CHARS);
  const truncated = cvText.trim().length > MAX_CV_CHARS;
  const hash = createHash("sha256").update(clipped).digest("hex");
  const cached = profileCache.get(hash);
  if (cached) return { profile: cached, truncated, fromCache: true };

  const note = truncated ? "\n\nThe CV was truncated. Use only the text included here." : "";
  const profile = await parseStructured(
    loadPrompt("cv_extraction.txt"),
    `CV TEXT:\n${clipped}${note}`,
    candidateProfileSchema,
    "candidate_profile",
  );
  rememberProfile(hash, profile);
  return { profile, truncated, fromCache: false };
}

export async function assessMatch(profile: CandidateProfile, job: JobPosting): Promise<{ match: MatchResult; truncated: boolean }> {
  const description = job.description.trim();
  const truncated = description.length > MAX_JOB_CHARS;
  const posted = { ...job, description: description.slice(0, MAX_JOB_CHARS) };
  const note = truncated ? "\n\nThe job description was truncated. Judge only the text included here." : "";
  const match = await parseStructured(
    loadPrompt("job_matching.txt"),
    ["CANDIDATE PROFILE:", JSON.stringify(profile), "JOB:", JSON.stringify(posted)].join("\n\n") + note,
    matchResultSchema,
    "match_result",
  );
  return { match, truncated };
}

export async function generateEmail(
  profile: CandidateProfile,
  job: JobPosting,
  match: MatchResult,
  score: number,
  classification: string,
): Promise<EmailDraft> {
  const brief = {
    classification,
    score,
    summary: match.summary,
    strengths: match.strengths.map((item) => item.title),
    matchedSkills: match.matchedSkills.slice(0, 12),
  };
  return parseStructured(
    loadPrompt("email_generation.txt"),
    [
      "CANDIDATE PROFILE:",
      JSON.stringify(profile),
      "JOB:",
      JSON.stringify(job),
      "ASSESSMENT BRIEF (do not mention the score in the email):",
      JSON.stringify(brief),
    ].join("\n\n"),
    emailDraftSchema,
    "email_draft",
  );
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of items) {
    const value = item.trim();
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return values;
}

export async function createAnalysis(profile: CandidateProfile, job: JobPosting): Promise<AnalysisRecord> {
  const { match } = await assessMatch(profile, job);
  const categories = orderCategories(match.categories);
  const score = weightedScore(categories);
  const classification = classify(score);
  let emailSubject = "";
  let emailBody = "";
  let emailError = "";
  try {
    const email = await generateEmail(profile, job, { ...match, categories }, score, classification);
    emailSubject = email.subject.trim();
    emailBody = email.body.trim();
  } catch (error) {
    emailError = error instanceof Error ? error.message : "The email draft failed.";
  }
  return {
    id: randomUUID().replaceAll("-", ""),
    createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    profile,
    job,
    score,
    classification,
    summary: match.summary.trim(),
    categories,
    matchedSkills: unique(match.matchedSkills),
    gaps: match.gaps,
    strengths: match.strengths,
    recommendations: match.recommendations,
    apply: match.apply,
    emailSubject,
    emailBody,
    emailError,
  };
}

export async function regenerateEmail(record: AnalysisRecord): Promise<EmailDraft> {
  const match: MatchResult = {
    summary: record.summary,
    categories: record.categories,
    matchedSkills: record.matchedSkills,
    gaps: record.gaps,
    strengths: record.strengths,
    recommendations: record.recommendations,
    apply: record.apply,
  };
  const email = await generateEmail(record.profile, record.job, match, record.score, record.classification);
  return { subject: email.subject.trim(), body: email.body.trim() };
}
