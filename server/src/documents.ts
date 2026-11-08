import path from "node:path";

import mammoth from "mammoth";

import "./pdf-runtime.js";
import { extractText, getDocumentProxy } from "unpdf";

import { MAX_UPLOAD_BYTES } from "./config.js";
import { AppError } from "./errors.js";

export async function parseDocument(fileBytes: Buffer, filename: string): Promise<string> {
  if (fileBytes.length === 0) throw new AppError("The file is empty.");
  if (fileBytes.length > MAX_UPLOAD_BYTES) throw new AppError("That file is larger than 10 MB.");

  const suffix = path.extname(filename).toLowerCase();
  let text = "";
  if (suffix === ".pdf") text = await readPdf(fileBytes);
  else if (suffix === ".docx") text = await readDocx(fileBytes);
  else if (suffix === ".doc") throw new AppError("Save the CV as DOCX or PDF and upload that file.");
  else throw new AppError("Upload a PDF or DOCX file.");

  const cleaned = text.trim();
  if (!cleaned) {
    throw new AppError("No text was found. If this is a scanned PDF, export a text-based PDF and try again.");
  }
  return cleaned;
}

async function readPdf(fileBytes: Buffer): Promise<string> {
  try {
    const document = await getDocumentProxy(new Uint8Array(fileBytes));
    const extracted = await extractText(document, { mergePages: false });
    const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    return pages
      .map((page) => page.trim())
      .filter(Boolean)
      .join("\n\n");
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/password/i.test(message)) {
      throw new AppError("This PDF is password protected. Remove the password and upload it again.");
    }
    throw new AppError("The PDF could not be read.");
  }
}

async function readDocx(fileBytes: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBytes });
    return result.value;
  } catch {
    throw new AppError("The DOCX file could not be read.");
  }
}
