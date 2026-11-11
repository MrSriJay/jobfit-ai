import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

import { ALLOW_BUILTIN, MAX_CV_CHARS, MAX_JOB_CHARS, MODEL, REASONING_EFFORT, ROOT } from "./config.js";
import { AppError, publicErrorText } from "./errors.js";
import { classify, orderCategories, weightedScore } from "./score.js";
import {
  applicationAnswerSchema,
  applicationPackSchema,
  candidateProfileSchema,
  emailDraftSchema,
  jobPageSchema,
  matchResultSchema,
  type AnalysisRecord,
  type CandidateProfile,
  type DraftKind,
  type EmailDraft,
  type JobPosting,
  type MatchResult,
} from "./schemas.js";

const promptCache = new Map<string, string>();
const profileCache = new Map<string, CandidateProfile>();

const promptFiles: Record<string, URL> = {
  "cv_extraction.txt": new URL("../../prompts/cv_extraction.txt", import.meta.url),
  "job_matching.txt": new URL("../../prompts/job_matching.txt", import.meta.url),
  "email_generation.txt": new URL("../../prompts/email_generation.txt", import.meta.url),
  "application_answer.txt": new URL("../../prompts/application_answer.txt", import.meta.url),
  "job_page.txt": new URL("../../prompts/job_page.txt", import.meta.url),
};

function loadPrompt(filename: string): string {
  const cached = promptCache.get(filename);
  if (cached) return cached;
  const bundled = promptFiles[filename];
  const candidates = [
    bundled ? fileURLToPath(bundled) : "",
    path.join(process.cwd(), "prompts", filename),
    path.join(ROOT, "prompts", filename),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const text = readFileSync(candidate, "utf8").trim();
      promptCache.set(filename, text);
      return text;
    } catch {
      // The local project and the Vercel bundle keep the prompt files in different places.
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

function usesReasoningEffort(model: string): boolean {
  return /^(o\d|gpt-5|gpt-6)/i.test(model.trim());
}

function rejectedReasoningEffort(error: unknown): boolean {
  const text = error instanceof Error ? error.message.toLowerCase() : "";
  return text.includes("reasoning.effort") && text.includes("not supported");
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
  let withReasoning = usesReasoningEffort(chosen.model);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.parse({
        model: chosen.model,
        instructions,
        input: userInput,
        text: { format: zodTextFormat(schema, name) },
        ...(withReasoning ? { reasoning: { effort: REASONING_EFFORT as "low" } } : {}),
        store: false,
      });
      if (!response.output_parsed) {
        throw new AppError("The model did not return a usable result. Try again.", 502);
      }
      return response.output_parsed;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (withReasoning && rejectedReasoningEffort(error)) {
        withReasoning = false;
        continue;
      }
      throw new AppError(publicErrorText(error), 502);
    }
  }
  throw new AppError("The model did not return a usable result. Try again.", 502);
}

export async function extractJobPage(pageText: string, options?: CallOptions): Promise<{ company: string; title: string; description: string }> {
  const clipped = pageText.trim().slice(0, 20_000);
  if (clipped.length < 400) {
    throw new AppError("This page did not include the job text. Enter the details below.");
  }
  const parsed = await parseStructured(
    loadPrompt("job_page.txt"),
    `JOB PAGE TEXT:\n${clipped}`,
    jobPageSchema,
    "job_page",
    options,
  );
  return {
    company: parsed.company.trim().slice(0, 200),
    title: parsed.title.trim().slice(0, 200),
    description: parsed.description.trim().slice(0, MAX_JOB_CHARS),
  };
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

const DRAFT_FIELD: Record<DraftKind, "email" | "hiringMessage" | "coverLetter"> = {
  email: "email",
  hiring: "hiringMessage",
  cover: "coverLetter",
};

function draftInstructions(kind: DraftKind | "all", language: CallOptions["language"]): string {
  const focus = kind === "all"
    ? "Write all three documents: email, hiringMessage, and coverLetter."
    : `Write only the ${DRAFT_FIELD[kind]}. Return its subject and body.`;
  return `${withLanguage(loadPrompt("email_generation.txt"), language)}\n\n${focus}`;
}

function draftInput(
  profile: CandidateProfile,
  job: JobPosting,
  match: MatchResult,
  score: number,
  classification: string,
): string {
  const brief = {
    classification,
    score,
    summary: match.summary,
    strengths: match.strengths.map((item) => item.title),
    matchedSkills: match.matchedSkills.slice(0, 12),
  };
  return [
    "CANDIDATE PROFILE:",
    JSON.stringify(profile),
    "JOB:",
    JSON.stringify(job),
    "ASSESSMENT BRIEF (do not mention the score in the documents):",
    JSON.stringify(brief),
  ].join("\n\n");
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
  let hiringSubject = "";
  let hiringBody = "";
  let coverSubject = "";
  let coverBody = "";
  let emailError = "";
  const assessed = { ...match, categories };
  try {
    const pack = await parseStructured(
      draftInstructions("all", options?.language),
      draftInput(profile, job, assessed, score, classification),
      applicationPackSchema,
      "application_drafts",
      options,
    );
    emailSubject = pack.email.subject.trim();
    emailBody = pack.email.body.trim();
    hiringSubject = pack.hiringMessage.subject.trim();
    hiringBody = pack.hiringMessage.body.trim();
    coverSubject = pack.coverLetter.subject.trim();
    coverBody = pack.coverLetter.body.trim();
  } catch (error) {
    emailError = error instanceof Error ? error.message : "The application drafts failed.";
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
    hiringSubject,
    hiringBody,
    coverSubject,
    coverBody,
    applicationAnswers: [],
  };
}

export async function answerApplicationQuestion(
  profile: CandidateProfile,
  job: JobPosting,
  question: string,
  options?: CallOptions,
): Promise<string> {
  const cleaned = question.trim();
  if (cleaned.length < 8 || cleaned.length > 2000) {
    throw new AppError("Paste an application question of at least a few words.", 400);
  }
  const result = await parseStructured(
    withLanguage(loadPrompt("application_answer.txt"), options?.language),
    ["CANDIDATE PROFILE:", JSON.stringify(profile), "JOB:", JSON.stringify(job), "APPLICATION QUESTION:", cleaned].join("\n\n"),
    applicationAnswerSchema,
    "application_answer",
    options,
  );
  const answer = result.answer.trim();
  if (!answer) throw new AppError("The model did not return a usable result. Try again.", 502);
  return answer;
}

export async function regenerateDraft(record: AnalysisRecord, kind: DraftKind, options?: CallOptions): Promise<EmailDraft> {
  const match: MatchResult = {
    summary: record.summary,
    categories: record.categories,
    matchedSkills: record.matchedSkills,
    gaps: record.gaps,
    strengths: record.strengths,
    recommendations: record.recommendations,
    apply: record.apply,
  };
  const draft = await parseStructured(
    draftInstructions(kind, options?.language),
    draftInput(record.profile, record.job, match, record.score, record.classification),
    emailDraftSchema,
    "application_draft",
    options,
  );
  return { subject: draft.subject.trim(), body: draft.body.trim() };
}
