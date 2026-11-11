import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import { ALLOW_BUILTIN, MODEL, PORT } from "./config.js";
import { parseDocument } from "./documents.js";
import { AppError, publicErrorText } from "./errors.js";
import { jobImageType } from "./jobImage.js";
import { loadJobPage } from "./jobPage.js";
import { answerApplicationQuestion, apiKeyConfigured, checkApiKey, createAnalysis, extractJobImage, extractJobPage, extractProfile, readCallOptions, regenerateDraft } from "./openai.js";
import { candidateProfileSchema, jobPostingSchema, matchResultSchema } from "./schemas.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

app.get("/api/status", (_req, res) => {
  res.json({ configured: apiKeyConfigured(), model: MODEL, allowBuiltin: ALLOW_BUILTIN });
});

app.post("/api/key-check", async (req, res, next) => {
  try {
    res.json(await checkApiKey(readCallOptions(req.body)));
  } catch (error) {
    next(error);
  }
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

app.post("/api/job-link", async (req, res, next) => {
  try {
    const url = typeof req.body?.url === "string" ? req.body.url : "";
    const page = await loadJobPage(url);
    let company = page.company.trim();
    let title = page.title.trim();
    let description = page.description.trim();
    if (description.length < 40) {
      const extracted = await extractJobPage(page.text, readCallOptions(req.body));
      company = company || extracted.company;
      title = title || extracted.title;
      description = extracted.description || description;
    }
    if (description.trim().length < 40) {
      throw new AppError("This page did not include the job text. Enter the details below.");
    }
    res.json({ company, title, description: description.trim() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/job-image", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError("Choose an image of the job post.");
    if (req.file.size > 8 * 1024 * 1024) throw new AppError("That image is larger than 8 MB.");
    const mime = jobImageType(req.file.mimetype, req.file.buffer);
    if (!mime) throw new AppError("Choose a PNG, JPEG, WEBP, or GIF image.");
    const extracted = await extractJobImage(req.file.buffer, mime, readCallOptions(parseOptions(req.body)));
    if (extracted.description.trim().length < 40) {
      throw new AppError("This image did not include the job text. Enter the details below.");
    }
    res.json(extracted);
  } catch (error) {
    next(error);
  }
});

app.post("/api/extract", async (req, res, next) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    if (text.trim().length < 40) throw new AppError("The CV does not contain enough text to extract a profile.");
    const result = await extractProfile(text, readCallOptions(req.body));
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
    }, readCallOptions(req.body));
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
    const requested = req.body?.kind;
    const kind = requested === "hiring" || requested === "cover" || requested === "email" ? requested : "email";
    const draft = await regenerateDraft({
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
      hiringSubject: "",
      hiringBody: "",
      coverSubject: "",
      coverBody: "",
      applicationAnswers: [],
    }, kind, readCallOptions(req.body));
    res.json(draft);
  } catch (error) {
    next(error);
  }
});

app.post("/api/answer", async (req, res, next) => {
  try {
    const profile = candidateProfileSchema.safeParse(req.body?.profile);
    const job = jobPostingSchema.safeParse(req.body?.job);
    const question = typeof req.body?.question === "string" ? req.body.question : "";
    if (!profile.success || !job.success) {
      throw new AppError("The saved profile or job could not be used.");
    }
    const answer = await answerApplicationQuestion(profile.data, job.data, question, readCallOptions(req.body));
    res.json({ answer });
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

function parseOptions(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const raw = (body as { options?: unknown }).options;
  if (typeof raw !== "string") return body;
  try {
    return { options: JSON.parse(raw) as unknown };
  } catch {
    return {};
  }
}

if (process.env.VERCEL !== "1") {
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`JobFit API listening on http://127.0.0.1:${PORT}`);
  });
}

export default app;
