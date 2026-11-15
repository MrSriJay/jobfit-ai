import type { StoredCv } from "./cvFile";

export interface MailDraft {
  to: string;
  subject: string;
  body: string;
  file?: StoredCv | null;
}

function encodeHeader(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  if (/^[\t\x20-\x7e]*$/.test(clean)) return clean;
  const bytes = new TextEncoder().encode(clean);
  return `=?UTF-8?B?${bytesToBase64(bytes)}?=`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

function wrap(value: string): string {
  return value.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function safeName(name: string): string {
  const cleaned = name.replace(/[\r\n"]/g, "").trim() || "cv.pdf";
  return cleaned;
}

function fileType(file: StoredCv): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

export function buildEml(draft: MailDraft): string {
  const boundary = `jobfit-${crypto.randomUUID()}`;
  const body = bytesToBase64(new TextEncoder().encode(draft.body));
  const parts = [
    "X-Unsent: 1",
    `To: ${encodeHeader(draft.to)}`,
    `Subject: ${encodeHeader(draft.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(body),
  ];
  if (draft.file && draft.file.bytes.byteLength > 0) {
    const filename = safeName(draft.file.name);
    parts.push(
      "",
      `--${boundary}`,
      `Content-Type: ${fileType(draft.file)}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      wrap(bytesToBase64(new Uint8Array(draft.file.bytes))),
    );
  }
  parts.push("", `--${boundary}--`, "");
  return parts.join("\r\n");
}

export function downloadEml(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
