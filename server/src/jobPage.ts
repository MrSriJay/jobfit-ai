import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { MAX_JOB_CHARS } from "./config.js";
import { AppError } from "./errors.js";

const PAGE_LIMIT = 1_500_000;
const FETCH_TIMEOUT_MS = 12_000;
const MIN_DESCRIPTION = 40;

export interface ParsedJobPage {
  company: string;
  title: string;
  description: string;
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  rsquo: "'",
  lsquo: "'",
  rdquo: "\"",
  ldquo: "\"",
  bull: "-",
};

export function normalizeJobUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function jobUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(normalizeJobUrl(raw));
  } catch {
    return "Enter a full job link, starting with https://.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Enter a full job link, starting with https://.";
  }
  if (url.username || url.password) return "That link cannot be read.";
  const host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "That link cannot be read.";
  }
  if (/^\d+$/.test(host)) return "That link cannot be read.";
  if (isIP(host) && isPrivateAddress(host)) return "That link cannot be read.";
  return null;
}

export function linkedInJobId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(normalizeJobUrl(raw));
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
  const match = url.pathname.match(/\/jobs\/view\/(?:.*-)?(\d{6,})\/?$/);
  return match?.[1] ?? null;
}

export function parseJobHtml(html: string): ParsedJobPage {
  const structured = jobPostingFromJsonLd(html);
  const linkedIn = linkedInFields(html);
  const heading = splitTitle(metaContent(html, "og:title") || titleText(html));
  const company = cleanField(structured.company || linkedIn.company || heading.company);
  const title = cleanField(structured.title || linkedIn.title || heading.title);
  const description = clip(structured.description || linkedIn.description);
  return { company, title, description, text: clip(htmlToText(html), 20_000) };
}

export async function loadJobPage(raw: string): Promise<ParsedJobPage> {
  const problem = jobUrlProblem(raw);
  if (problem) throw new AppError(problem);
  const url = new URL(normalizeJobUrl(raw));
  const guestId = linkedInJobId(url.toString());
  const attempts = guestId
    ? [new URL(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${guestId}`), url]
    : [url];
  let best: ParsedJobPage | null = null;
  let lastError: AppError | null = null;
  for (const attempt of attempts) {
    try {
      const html = await fetchPublicPage(attempt);
      const parsed = parseJobHtml(html);
      if (parsed.description.length >= MIN_DESCRIPTION && parsed.title) return parsed;
      if (preferPage(parsed, best)) best = parsed;
    } catch (error) {
      lastError = error instanceof AppError ? error : new AppError("The job page could not be read. Enter the details below.");
    }
  }
  if (best && (best.description.length >= MIN_DESCRIPTION || best.text.length >= 400)) return best;
  throw lastError ?? new AppError("This page did not include the job text. Enter the details below.");
}

function preferPage(next: ParsedJobPage, current: ParsedJobPage | null): boolean {
  if (!current) return true;
  if (next.description.length !== current.description.length) return next.description.length > current.description.length;
  return next.text.length > current.text.length;
}

function jobPostingFromJsonLd(html: string): { company: string; title: string; description: string } {
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const found: Record<string, unknown>[] = [];
  for (const match of html.matchAll(pattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      collectJobPostings(JSON.parse(raw) as unknown, found);
    } catch {
      // A page can contain more than one data block. Skip a block that is not JSON.
    }
  }
  const posting = found[0];
  if (!posting) return { company: "", title: "", description: "" };
  return {
    company: organizationName(posting.hiringOrganization),
    title: typeof posting.title === "string" ? posting.title : "",
    description: typeof posting.description === "string" ? htmlToText(posting.description) : "",
  };
}

function collectJobPostings(node: unknown, found: Record<string, unknown>[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectJobPostings(item, found);
    return;
  }
  const record = node as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => String(item).toLowerCase() === "jobposting")) found.push(record);
  if (record["@graph"]) collectJobPostings(record["@graph"], found);
}

function organizationName(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

function linkedInFields(html: string): { company: string; title: string; description: string } {
  return {
    title: htmlToText(sliceByClass(html, "top-card-layout__title") || sliceByClass(html, "topcard__title")),
    company: htmlToText(sliceByClass(html, "topcard__org-name-link") || sliceByClass(html, "top-card-layout__company-name")),
    description: htmlToText(sliceByClass(html, "show-more-less-html__markup") || sliceByClass(html, "description__text")),
  };
}

function sliceByClass(html: string, token: string): string {
  const lower = html.toLowerCase();
  const classAt = lower.indexOf(token.toLowerCase());
  if (classAt < 0) return "";
  const tagStart = html.lastIndexOf("<", classAt);
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(tagStart))?.[1]?.toLowerCase();
  if (!tag) return "";
  const contentStart = html.indexOf(">", classAt) + 1;
  if (contentStart <= 0) return "";
  const openToken = `<${tag}`;
  const closeToken = `</${tag}>`;
  let depth = 1;
  let index = contentStart;
  while (depth > 0 && index < lower.length) {
    const nextOpen = lower.indexOf(openToken, index);
    const nextClose = lower.indexOf(closeToken, index);
    if (nextClose < 0) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      index = nextOpen + openToken.length;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(contentStart, nextClose);
      index = nextClose + closeToken.length;
    }
  }
  return "";
}

function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const first = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i");
  const second = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i");
  return decodeEntities(html.match(first)?.[1] ?? html.match(second)?.[1] ?? "");
}

function titleText(html: string): string {
  return htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}

function splitTitle(value: string): { title: string; company: string } {
  const cleaned = value.replace(/\s*[|–-]\s*LinkedIn\s*$/i, "").trim();
  const at = cleaned.match(/^(.*?)\s+at\s+(.+)$/i);
  if (at?.[1] && at[2]) return { title: at[1].trim(), company: at[2].trim() };
  const parts = cleaned.split(/\s+\|\s+/);
  if (parts.length === 2) return { title: parts[0].trim(), company: parts[1].trim() };
  return { title: cleaned, company: "" };
}

function htmlToText(html: string): string {
  const withoutCode = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const spaced = withoutCode
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section)\b[^>]*>/gi, "\n");
  return decodeEntities(spaced.replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanField(value: string): string {
  return decodeEntities(value).replace(/\s+/g, " ").trim().slice(0, 200);
}

function clip(value: string, max = MAX_JOB_CHARS): string {
  return value.trim().slice(0, max);
}

function isPrivateAddress(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = ipv4Parts(normalized);
  if (!parts) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function ipv4Parts(ip: string): number[] | null {
  const mapped = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const parts = mapped.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return nums;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

async function fetchPublicPage(url: URL): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    const problem = jobUrlProblem(current.toString());
    if (problem) throw new AppError(problem === "Enter a full job link, starting with https://." ? "That link cannot be read." : problem);
    await assertPublicHost(current.hostname.replace(/^\[|\]$/g, ""));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "Accept-Language": "en",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new AppError("The job page could not be read. Enter the details below.");
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new AppError("The job page could not be read. Enter the details below.");
      const type = response.headers.get("content-type") ?? "";
      if (type && !/html|json|xml|text\/plain/i.test(type)) {
        throw new AppError("That link is not a job page. Enter the details below.");
      }
      return await readLimited(response);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("The job page could not be read. Enter the details below.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new AppError("The job page could not be read. Enter the details below.");
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.toLowerCase();
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new AppError("That link cannot be read.");
    return;
  }
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new AppError("The job page could not be read. Enter the details below.");
  }
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new AppError("That link cannot be read.");
  }
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > PAGE_LIMIT) {
      await reader.cancel();
      throw new AppError("That page is too large to read. Enter the details below.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
