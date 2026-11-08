import { loadPreferences, requestOptions } from "./preferences";
import type { AnalysisRecord, CandidateProfile, JobPosting, MatchResult } from "./types";

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error || "The request failed.";
}

export async function apiKeyCheck(useOwn: boolean): Promise<{ configured: boolean; working: boolean }> {
  const prefs = loadPreferences();
  const options = useOwn
    ? { language: prefs.language, useOwnKey: true, apiKey: prefs.apiKey.trim(), model: prefs.model.trim() }
    : { language: prefs.language, useOwnKey: false };
  const response = await fetch("/api/key-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ options }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { configured?: boolean; working?: boolean };
  return { configured: Boolean(data.configured), working: Boolean(data.working) };
}

export async function apiStatus(): Promise<{ configured: boolean; model: string; allowBuiltin: boolean }> {
  const response = await fetch("/api/status");
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { configured?: boolean; model?: string; allowBuiltin?: boolean };
  return { configured: Boolean(data.configured), model: data.model || "", allowBuiltin: data.allowBuiltin !== false };
}

export async function parseCv(file: File): Promise<{ filename: string; characters: number; preview: string; text: string }> {
  const body = new FormData();
  body.append("cv", file);
  const response = await fetch("/api/parse", { method: "POST", body });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<{ filename: string; characters: number; preview: string; text: string }>;
}

export async function extractProfile(text: string): Promise<{ profile: CandidateProfile; truncated: boolean; fromCache: boolean }> {
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, options: requestOptions() }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<{ profile: CandidateProfile; truncated: boolean; fromCache: boolean }>;
}

export async function analyzeJob(profile: CandidateProfile, job: JobPosting): Promise<AnalysisRecord> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, job, options: requestOptions() }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { record: AnalysisRecord };
  return data.record;
}

export async function regenerateEmail(record: AnalysisRecord): Promise<{ subject: string; body: string }> {
  const match: MatchResult = {
    summary: record.summary,
    categories: record.categories,
    matchedSkills: record.matchedSkills,
    gaps: record.gaps,
    strengths: record.strengths,
    recommendations: record.recommendations,
    apply: record.apply,
  };
  const response = await fetch("/api/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile: record.profile,
      job: record.job,
      match,
      score: record.score,
      classification: record.classification,
      options: requestOptions(),
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<{ subject: string; body: string }>;
}
