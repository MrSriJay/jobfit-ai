import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

import { ALLOW_BUILTIN, MAX_CV_CHARS, MAX_JOB_CHARS, MODEL, REASONING_EFFORT, ROOT } from "./config.js";
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
  const candidates = [path.join(process.cwd(), "prompts", filename), path.join(ROOT, "prompts", filename)];
  for (const candidate of candidates) {
    try {
      const text = readFileSync(candidate, "utf8").trim();
      promptCache.set(filename, text);
      return text;
    } catch {
      // Try the next location. The local project root and the Vercel bundle keep the prompts in different places.
    }
  }
  throw new AppError("The analysis instructions are unavailable.", 500);
}

export interface CallOptions {
  apiKey?: string;
  model?: string;
  language?: "en" | "si" | "ta";
}

export function readCallOptions(body: unknown): CallOptions {
  if (!body || typeof body !== "object") return { language: "en" };
  const options = (body as { options?: unknown }).options;
  if (!options || typeof options !== "object") return { language: "en" };
  const record = options as Record<string, unknown>;
  const language = record.language === "si" || record.language === "ta" ? record.language : "en";
  if (record.useOwnKey !== true) return { language };
  return {
    language,
    apiKey: typeof record.apiKey === "string" ? record.apiKey : "",
    model: typeof record.model === "string" ? record.model : "",
  };
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!key) {
    throw new AppError("The built-in key is unavailable. Add your API key and model in Settings.", 503);
  }
  return key;
}

function credentials(options?: CallOptions): { apiKey: string; model: string } {
  const key = options?.apiKey?.trim() ?? "";
  const model = options?.model?.trim() ?? "";
  const usingOwn = options?.apiKey !== undefined || options?.model !== undefined;
  if (!ALLOW_BUILTIN || usingOwn) {
    if (!usingOwn) throw new AppError("Add your API key and model in Settings.", 400);
    if (key.length < 20 || key.length > 300 || /\s/.test(key)) {
      throw new AppError("Enter a valid OpenAI API key in Settings.", 400);
    }
    if (!/^[A-Za-z0-9._:-]{2,80}$/.test(model)) {
      throw new AppError("Enter the model name to use with your API key.", 400);
    }
    return { apiKey: key, model };
  }
  return { apiKey: apiKey(), model: MODEL };
}

function withLanguage(instructions: string, language: CallOptions["language"]): string {
  const name = language === "si" ? "Sinhala" : language === "ta" ? "Tamil" : "English";
  return `${instructions}\n\nWrite every natural-language sentence in ${name}. Keep JSON keys, enum values, numbers, and URLs unchanged. Keep established technical terms in their usual written form.`;
}

export function apiKeyConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function checkApiKey(options?: CallOptions): Promise<{ configured: boolean; working: boolean }> {
  let chosen: { apiKey: string; model: string };
  try {
    chosen = credentials(options);
  } catch {
    return { configured: false, working: false };
  }
  const client = new OpenAI({ apiKey: chosen.apiKey, timeout: 20_000, maxRetries: 0 });
  try {
    await client.models.retrieve(chosen.model);
    return { configured: true, working: true };
  } catch {
    return { configured: true, working: false };
  }
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

async function parseStructured<T>(
  instructions: string,
  userInput: string,
  schema: ZodType<T>,
  name: string,
  options?: CallOptions,
): Promise<T> {
  const chosen = credentials(options);
  const client = new OpenAI({ apiKey: chosen.apiKey, timeout: process.env.VERCEL === "1" ? 50_000 : 180_000 });
  try {
    const response = await client.responses.parse({
      model: chosen.model,
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

export async function extractProfile(cvText: string, options?: CallOptions): Promise<{ profile: CandidateProfile; truncated: boolean; fromCache: boolean }> {
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
    options,
  );
  rememberProfile(hash, profile);
  return { profile, truncated, fromCache: false };
}

export async function assessMatch(profile: CandidateProfile, job: JobPosting, options?: CallOptions): Promise<{ match: MatchResult; truncated: boolean }> {
  const description = job.description.trim();
  const truncated = description.length > MAX_JOB_CHARS;
  const posted = { ...job, description: description.slice(0, MAX_JOB_CHARS) };
  const note = truncated ? "\n\nThe job description was truncated. Judge only the text included here." : "";
  const match = await parseStructured(
    withLanguage(loadPrompt("job_matching.txt"), options?.language),
    ["CANDIDATE PROFILE:", JSON.stringify(profile), "JOB:", JSON.stringify(posted)].join("\n\n") + note,
    matchResultSchema,
    "match_result",
    options,
  );
  return { match, truncated };
}

export async function generateEmail(
  profile: CandidateProfile,
  job: JobPosting,
  match: MatchResult,
  score: number,
  classification: string,
  options?: CallOptions,
): Promise<EmailDraft> {
  const brief = {
    classification,
    score,
    summary: match.summary,
    strengths: match.strengths.map((item) => item.title),
    matchedSkills: match.matchedSkills.slice(0, 12),
  };
  return parseStructured(
    withLanguage(loadPrompt("email_generation.txt"), options?.language),
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
    options,
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

export async function createAnalysis(profile: CandidateProfile, job: JobPosting, options?: CallOptions): Promise<AnalysisRecord> {
  const { match } = await assessMatch(profile, job, options);
  const categories = orderCategories(match.categories);
  const score = weightedScore(categories);
  const classification = classify(score);
  let emailSubject = "";
  let emailBody = "";
  let emailError = "";
  try {
    const email = await generateEmail(profile, job, { ...match, categories }, score, classification, options);
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

export async function regenerateEmail(record: AnalysisRecord, options?: CallOptions): Promise<EmailDraft> {
  const match: MatchResult = {
    summary: record.summary,
    categories: record.categories,
    matchedSkills: record.matchedSkills,
    gaps: record.gaps,
    strengths: record.strengths,
    recommendations: record.recommendations,
    apply: record.apply,
  };
  const email = await generateEmail(record.profile, record.job, match, record.score, record.classification, options);
  return { subject: email.subject.trim(), body: email.body.trim() };
}
