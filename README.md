# JobFit AI

JobFit AI compares a CV with a job description and explains the match. Upload a resume once, then check different jobs without uploading it again. The app drafts an application email and can export the report as a PDF.

There are no accounts and no database. The CV profile, job drafts, and past reports stay in this browser.

The interface is a React and TypeScript app. A small Node server reads the CV file and calls OpenAI. The API key stays in `.env` and is never sent to the browser.

## What you can do

1. Drop a PDF or DOCX CV onto the page and review the extracted profile.
2. Paste a job title and description.
3. Read a 0–100 match score, matched skills, gaps, and recommendations.
4. Edit, copy, or open a draft application email.
5. Download a PDF report.
6. Open Settings in the top bar to revisit a saved analysis or clear local data.

The score is a weighted sum of five category scores. The model scores each category. The server calculates the total.

| Criteria | Weight |
| --- | --- |
| Technical and professional skills | 35% |
| Relevant work experience | 25% |
| Responsibilities and role alignment | 20% |
| Seniority and experience level | 10% |
| Education and certifications | 10% |

| Score | Classification |
| --- | --- |
| 85–100% | Excellent match |
| 70–84% | Strong match |
| 50–69% | Partial match |
| 30–49% | Weak match |
| 0–29% | Poor match |

## Setup

Node.js 20 or newer.

```powershell
copy .env.example .env
npm install
npm run dev
```

Put `OPENAI_API_KEY` in `.env`. The default model is `gpt-5.6-sol`. Optional settings:

```
OPENAI_MODEL=gpt-5.6-sol
OPENAI_REASONING_EFFORT=low
```

The app opens at http://127.0.0.1:5173. The API listens on http://127.0.0.1:8787.

```powershell
npm test
npm run typecheck
```

## Privacy

CV text and job descriptions are sent to OpenAI only when you extract a profile, analyze a job, or regenerate an email. Requests are made with `store` set to false. Profiles and reports are written to this browser's local storage under `jobfit-ai-v1`. The server keeps a short in-memory cache of recent extractions so the same CV text is not billed twice in one run.
