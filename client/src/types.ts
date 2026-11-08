export interface ExperienceItem {
  title: string;
  company: string;
  start: string;
  end: string;
  highlights: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  dates: string;
  details: string;
}

export interface ProjectItem {
  name: string;
  description: string;
  technologies: string[];
}

export interface CertificationItem {
  name: string;
  issuer: string;
  date: string;
}

export interface CandidateProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  professionalSummary: string;
  skills: string[];
  technologies: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
}

export interface JobPosting {
  company: string;
  title: string;
  description: string;
  url: string;
}

export type Criterion = "skills" | "experience" | "responsibilities" | "seniority" | "education";

export interface CategoryAssessment {
  criterion: Criterion;
  score: number;
  explanation: string;
  evidence: string[];
}

export interface MatchResult {
  summary: string;
  categories: CategoryAssessment[];
  matchedSkills: string[];
  gaps: { skill: string; status: "missing_evidence" | "confirmed_absence"; explanation: string }[];
  strengths: { title: string; detail: string }[];
  recommendations: { area: "emphasize" | "cv" | "interview"; advice: string }[];
  apply: { verdict: "worth_applying" | "apply_with_caveats" | "low_priority"; explanation: string };
}

export interface AnalysisRecord extends MatchResult {
  id: string;
  createdAt: string;
  profile: CandidateProfile;
  job: JobPosting;
  score: number;
  classification: string;
  emailSubject: string;
  emailBody: string;
  emailError: string;
}

export const CRITERIA: { key: Criterion; label: string; weight: string }[] = [
  { key: "skills", label: "Technical and professional skills", weight: "35%" },
  { key: "experience", label: "Relevant work experience", weight: "25%" },
  { key: "responsibilities", label: "Responsibilities and role alignment", weight: "20%" },
  { key: "seniority", label: "Seniority and experience level", weight: "10%" },
  { key: "education", label: "Education and certifications", weight: "10%" },
];

export const VERDICT_LABELS: Record<MatchResult["apply"]["verdict"], string> = {
  worth_applying: "Worth applying",
  apply_with_caveats: "Apply with caveats",
  low_priority: "Lower priority",
};

export const GAP_LABELS: Record<MatchResult["gaps"][number]["status"], string> = {
  missing_evidence: "Not evidenced in the CV. This is not a confirmed lack of ability.",
  confirmed_absence: "The CV indicates this requirement is outside the demonstrated background.",
};

export const AREA_ORDER = ["emphasize", "cv", "interview"] as const;

export const AREA_LABELS: Record<(typeof AREA_ORDER)[number], string> = {
  emphasize: "Skills and experience to emphasize",
  cv: "CV improvements for this role",
  interview: "Interview preparation",
};
