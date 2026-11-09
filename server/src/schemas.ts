import { z } from "zod";

const text = (description: string) => z.string().describe(description);

export const experienceItemSchema = z.object({
  title: text("Job title as written in the CV."),
  company: text("Employer or organization. Empty if unknown."),
  start: text("Start date as written. Empty if unknown."),
  end: text("End date or Present. Empty if unknown."),
  highlights: z.array(z.string()).describe("Short evidence bullets taken from the CV, not inferred."),
});

export const educationItemSchema = z.object({
  degree: text("Degree, diploma, or program name."),
  institution: text("School or provider. Empty if unknown."),
  dates: text("Dates as written. Empty if unknown."),
  details: text("Honors, focus, or coursework stated in the CV."),
});

export const projectItemSchema = z.object({
  name: text("Project name."),
  description: text("What the CV says the project involved."),
  technologies: z.array(z.string()).describe("Tools or languages named for this project."),
});

export const certificationItemSchema = z.object({
  name: text("Certification or license name."),
  issuer: text("Issuing organization. Empty if unknown."),
  date: text("Date as written. Empty if unknown."),
});

export const candidateProfileSchema = z.object({
  name: text("Candidate name. Empty if it is not in the CV."),
  email: text("Email address. Empty if it is not in the CV."),
  phone: z.array(z.string()).describe("Each phone number from the CV, as its own item. Empty if none."),
  location: text("City, region, or country. Empty if unknown."),
  links: z.array(z.string()).describe("Profile URLs such as LinkedIn or a portfolio."),
  professionalSummary: text("A short summary using only facts stated in the CV."),
  skills: z.array(z.string()).describe("Professional and technical skills evidenced in the CV."),
  technologies: z.array(z.string()).describe("Languages, frameworks, platforms, and tools named in the CV."),
  experience: z.array(experienceItemSchema),
  education: z.array(educationItemSchema),
  projects: z.array(projectItemSchema),
  certifications: z.array(certificationItemSchema),
});

export const jobPostingSchema = z.object({
  company: z.string().default(""),
  title: z.string(),
  description: z.string(),
  url: z.string().default(""),
});

export const categorySchema = z.object({
  criterion: z.enum(["skills", "experience", "responsibilities", "seniority", "education"]),
  score: z.number().describe("0 to 100, based only on evidence in the CV and the job."),
  explanation: text("Why this category received this score."),
  evidence: z.array(z.string()).describe("Short CV evidence used for the score. Empty if none."),
});

export const matchResultSchema = z.object({
  summary: text("Two or three sentences on the overall fit. No numeric score."),
  categories: z.array(categorySchema),
  matchedSkills: z.array(z.string()),
  gaps: z.array(
    z.object({
      skill: z.string(),
      status: z
        .enum(["missing_evidence", "confirmed_absence"])
        .describe(
          "missing_evidence when the CV simply does not show the skill. confirmed_absence only when the CV explicitly indicates the candidate does not have it.",
        ),
      explanation: z.string(),
    }),
  ),
  strengths: z.array(z.object({ title: z.string(), detail: z.string() })),
  recommendations: z.array(
    z.object({
      area: z.enum(["emphasize", "cv", "interview"]),
      advice: z.string(),
    }),
  ),
  apply: z.object({
    verdict: z.enum(["worth_applying", "apply_with_caveats", "low_priority"]),
    explanation: z.string(),
  }),
});

export const emailDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export const applicationPackSchema = z.object({
  email: emailDraftSchema,
  hiringMessage: emailDraftSchema,
  coverLetter: emailDraftSchema,
});

export type DraftKind = "email" | "hiring" | "cover";

export const applicationAnswerSchema = z.object({
  answer: z.string(),
});

export interface ApplicationAnswer {
  question: string;
  answer: string;
}

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
export type JobPosting = z.infer<typeof jobPostingSchema>;
export type CategoryAssessment = z.infer<typeof categorySchema>;
export type MatchResult = z.infer<typeof matchResultSchema>;
export type EmailDraft = z.infer<typeof emailDraftSchema>;

export interface AnalysisRecord {
  id: string;
  createdAt: string;
  profile: CandidateProfile;
  job: JobPosting;
  score: number;
  classification: string;
  summary: string;
  categories: CategoryAssessment[];
  matchedSkills: string[];
  gaps: MatchResult["gaps"];
  strengths: MatchResult["strengths"];
  recommendations: MatchResult["recommendations"];
  apply: MatchResult["apply"];
  emailSubject: string;
  emailBody: string;
  emailError: string;
  hiringSubject: string;
  hiringBody: string;
  coverSubject: string;
  coverBody: string;
  applicationAnswers: ApplicationAnswer[];
}
