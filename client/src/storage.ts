import type { AnalysisRecord, CandidateProfile, JobPosting } from "./types";

const STORAGE_KEY = "jobfit-ai-v1";
const MAX_HISTORY = 20;
const MAX_PAYLOAD = 4_000_000;

export interface Snapshot {
  profile: CandidateProfile | null;
  cvFilename: string;
  history: AnalysisRecord[];
  currentAnalysisId: string;
  draftJob: JobPosting | null;
}

export const emptySnapshot = (): Snapshot => ({
  profile: null,
  cvFilename: "",
  history: [],
  currentAnalysisId: "",
  draftJob: null,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textList(value: unknown, separator: RegExp): string[] {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return parts.flatMap((item) => (typeof item === "string" ? item.split(separator) : [])).map((item) => item.trim()).filter(Boolean);
}

function normalizeProfile(value: Record<string, unknown>): CandidateProfile {
  const profile = value as unknown as CandidateProfile;
  return {
    ...profile,
    phone: textList(value.phone, /\s*(?:;|\||\n|\/)\s*/),
    links: textList(value.links, /\n+/),
  };
}

export function loadSnapshot(): Snapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySnapshot();
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return emptySnapshot();
    const history = Array.isArray(data.history) ? data.history.filter(isRecord).slice(0, MAX_HISTORY) : [];
    const typedHistory = history as unknown as AnalysisRecord[];
    let currentAnalysisId = typeof data.currentAnalysisId === "string" ? data.currentAnalysisId : "";
    if (currentAnalysisId && !typedHistory.some((item) => item.id === currentAnalysisId)) {
      currentAnalysisId = typedHistory[0]?.id ?? "";
    }
    return {
      profile: isRecord(data.profile) ? normalizeProfile(data.profile) : null,
      cvFilename: typeof data.cvFilename === "string" ? data.cvFilename : "",
      history: typedHistory.map((item) => ({
        ...item,
        profile: isRecord(item.profile) ? normalizeProfile(item.profile) : item.profile,
      })),
      currentAnalysisId,
      draftJob: isRecord(data.draftJob) ? (data.draftJob as unknown as JobPosting) : null,
    };
  } catch {
    return emptySnapshot();
  }
}

export function saveSnapshot(snapshot: Snapshot): void {
  let history = snapshot.history.slice(0, MAX_HISTORY);
  let payload = JSON.stringify({ ...snapshot, history });
  while (payload.length > MAX_PAYLOAD && history.length > 0) {
    history = history.slice(0, -1);
    payload = JSON.stringify({ ...snapshot, history });
  }
  localStorage.setItem(STORAGE_KEY, payload);
}
