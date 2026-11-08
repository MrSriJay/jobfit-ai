import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import { PORT } from "./config.js";
import { parseDocument } from "./documents.js";
import { AppError, publicErrorText } from "./errors.js";
import { apiKeyConfigured, createAnalysis, extractProfile, regenerateEmail } from "./openai.js";
import { candidateProfileSchema, jobPostingSchema, matchResultSchema } from "./schemas.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

app.get("/api/status", (_req, res) => {
  res.json({ configured: apiKeyConfigured() });
});

app.post("/api/parse", upload.single("cv"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError("Upload a PDF or DOCX file.");
    const text = await parseDocument(req.file.buffer, req.file.originalname);
    res.json({
      filename: req.file.originalname,
      characters: text.length,
      preview: text.slice(0, 4000),
      text,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/extract", async (req, res, next) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    if (text.trim().length < 40) throw new AppError("The CV does not contain enough text to extract a profile.");
    const result = await extractProfile(text);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze", async (req, res, next) => {
  try {
    const profile = candidateProfileSchema.safeParse(req.body?.profile);
    const job = jobPostingSchema.safeParse(req.body?.job);
    if (!profile.success || !job.success) {
      throw new AppError("The profile or job details are incomplete.");
    }
    if (!job.data.title.trim() || job.data.description.trim().length < 40) {
      throw new AppError("Enter a job title and a job description of at least a few sentences.");
    }
    const record = await createAnalysis(profile.data, {
      ...job.data,
      company: job.data.company.trim(),
      title: job.data.title.trim(),
      description: job.data.description.trim(),
      url: job.data.url.trim(),
    });
    res.json({ record });
  } catch (error) {
    next(error);
  }
});

app.post("/api/email", async (req, res, next) => {
  try {
    const profile = candidateProfileSchema.safeParse(req.body?.profile);
    const job = jobPostingSchema.safeParse(req.body?.job);
    const match = matchResultSchema.safeParse(req.body?.match);
    const score = Number(req.body?.score);
    const classification = typeof req.body?.classification === "string" ? req.body.classification : "";
    if (!profile.success || !job.success || !match.success || !Number.isFinite(score)) {
      throw new AppError("The saved analysis could not be used to draft an email.");
    }
    const email = await regenerateEmail({
      id: "",
      createdAt: "",
      profile: profile.data,
      job: job.data,
      score,
      classification,
      summary: match.data.summary,
      categories: match.data.categories,
      matchedSkills: match.data.matchedSkills,
      gaps: match.data.gaps,
      strengths: match.data.strengths,
      recommendations: match.data.recommendations,
      apply: match.data.apply,
      emailSubject: "",
      emailBody: "",
      emailError: "",
    });
    res.json(email);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "That file is larger than 10 MB." });
    return;
  }
  const status = error instanceof AppError ? error.status : 500;
  res.status(status).json({ error: publicErrorText(error) });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`JobFit API listening on http://127.0.0.1:${PORT}`);
});
