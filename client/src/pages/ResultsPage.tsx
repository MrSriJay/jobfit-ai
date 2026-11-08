import { Copy, Download, ExternalLink, LoaderCircle, Mail, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { regenerateEmail } from "../api";
import { buildReportPdf, downloadPdf, safeFilename } from "../pdf";
import { useStore } from "../state";
import { AREA_LABELS, AREA_ORDER, CRITERIA, GAP_LABELS, VERDICT_LABELS, type AnalysisRecord } from "../types";

const MAILTO_LIMIT = 1800;

function mailto(subject: string, body: string): string | null {
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return url.length > MAILTO_LIMIT ? null : url;
}

export function ResultsPage() {
  const { snapshot, replaceAnalysis, notify } = useStore();
  const record = snapshot.history.find((item) => item.id === snapshot.currentAnalysisId) ?? null;

  if (!record) {
    return (
      <section className="page">
        <p className="eyebrow">Step 3</p>
        <h1>Match analysis</h1>
        <div className="empty">
          <Sparkles size={18} />
          <div>
            <strong>No analysis yet</strong>
            <p>Analyze a job description to see a match report and an application email.</p>
          </div>
        </div>
        <Link className="btn primary" to="/job">
          Enter a job description
        </Link>
      </section>
    );
  }

  return <Report record={record} onChange={replaceAnalysis} notify={notify} />;
}

function Report({
  record,
  onChange,
  notify,
}: {
  record: AnalysisRecord;
  onChange: (record: AnalysisRecord) => void;
  notify: (message: string) => void;
}) {
  const [subject, setSubject] = useState(record.emailSubject);
  const [body, setBody] = useState(record.emailBody);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(record.emailError);
  const [score, setScore] = useState(0);
  const company = record.job.company.trim();
  const heading = company ? `${record.job.title} at ${company}` : record.job.title;
  const mail = mailto(subject, body);
  const posting = /^https?:\/\//i.test(record.job.url.trim()) ? record.job.url.trim() : "";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setScore(record.score));
    return () => window.cancelAnimationFrame(frame);
  }, [record.score]);

  useEffect(() => {
    setSubject(record.emailSubject);
    setBody(record.emailBody);
    setError(record.emailError);
  }, [record.id, record.emailSubject, record.emailBody, record.emailError]);

  const persistEmail = (nextSubject: string, nextBody: string) => {
    if (nextSubject === record.emailSubject && nextBody === record.emailBody) return;
    onChange({ ...record, emailSubject: nextSubject, emailBody: nextBody, emailError: "" });
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      notify("Email copied");
    } catch {
      setError("The browser blocked clipboard access. Select the email text and copy it manually.");
    }
  };

  const download = async () => {
    const bytes = await buildReportPdf({ ...record, emailSubject: subject, emailBody: body });
    downloadPdf(bytes, `${safeFilename(`jobfit-${record.job.company}-${record.job.title}`)}.pdf`);
  };

  const regenerate = async () => {
    setBusy(true);
    setError("");
    try {
      const email = await regenerateEmail(record);
      setSubject(email.subject);
      setBody(email.body);
      onChange({ ...record, emailSubject: email.subject, emailBody: email.body, emailError: "" });
      notify("Email updated");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The email could not be drafted.");
    } finally {
      setBusy(false);
    }
  };

  const verdictClass =
    record.apply.verdict === "worth_applying" ? "ok" : record.apply.verdict === "low_priority" ? "warn" : "info";

  return (
    <section className="page">
      <p className="eyebrow">Step 3</p>
      <h1>Match analysis</h1>
      <div className="score-hero">
        <div className="ring" style={{ ["--p" as string]: score }} aria-label={`Match score ${record.score} out of 100`}>
          <strong>{record.score}</strong>
          <span>out of 100</span>
        </div>
        <div>
          <p className="band">{record.classification}</p>
          <h2>{heading}</h2>
          <p className="fine">{record.createdAt.replace("T", " ").replace("Z", " UTC")}</p>
          {posting ? (
            <a className="text-link" href={posting} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Job posting
            </a>
          ) : null}
        </div>
      </div>

      <div className={`banner ${verdictClass}`}>
        <strong>{VERDICT_LABELS[record.apply.verdict]}</strong>
        <p>{record.apply.explanation}</p>
      </div>

      <article className="card">
        <h2>Match summary</h2>
        <p>{record.summary}</p>
      </article>

      <article className="card">
        <h2>Category scores</h2>
        <ul className="bars">
          {record.categories.map((category) => {
            const label = CRITERIA.find((item) => item.key === category.criterion);
            return (
              <li key={category.criterion}>
                <div>
                  <span>{label?.label ?? category.criterion}</span>
                  <strong>{category.score}</strong>
                </div>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${category.score}%` }} />
                </div>
                <small>{label?.weight} of the total</small>
              </li>
            );
          })}
        </ul>
        <details className="preview">
          <summary>How this score is calculated</summary>
          <p>Each category is scored from the CV and the job. The percentage is the weighted sum, rounded to the nearest point.</p>
          <ul className="plain">
            {CRITERIA.map((item) => (
              <li key={item.key}>
                {item.label} · {item.weight}
              </li>
            ))}
          </ul>
          <p className="fine">85–100 excellent · 70–84 strong · 50–69 partial · 30–49 weak · 0–29 poor</p>
        </details>
        {record.categories.map((category) => {
          const label = CRITERIA.find((item) => item.key === category.criterion);
          return (
            <details key={`${category.criterion}-note`} className="note">
              <summary>
                {label?.label} · {category.score}/100
              </summary>
              <p>{category.explanation}</p>
              {category.evidence.map((item) => (
                <p key={item} className="fine">
                  {item}
                </p>
              ))}
            </details>
          );
        })}
      </article>

      <article className="card">
        <h2>Matched skills</h2>
        {record.matchedSkills.length === 0 ? (
          <p className="fine">No overlapping skills were identified.</p>
        ) : (
          <div className="chips">
            {record.matchedSkills.map((skill) => (
              <span key={skill} className="chip">
                {skill}
              </span>
            ))}
          </div>
        )}
      </article>

      <article className="card">
        <h2>Missing or weak skills</h2>
        {record.gaps.length === 0 ? <p className="fine">No important gaps were identified.</p> : null}
        {record.gaps.map((gap) => (
          <div key={`${gap.skill}-${gap.status}`} className="note-card">
            <strong>{gap.skill}</strong>
            <p className="fine">{GAP_LABELS[gap.status]}</p>
            <p>{gap.explanation}</p>
          </div>
        ))}
      </article>

      <article className="card">
        <h2>Candidate strengths</h2>
        {record.strengths.length === 0 ? <p className="fine">No standout strengths were identified for this role.</p> : null}
        {record.strengths.map((strength) => (
          <div key={strength.title} className="note-card">
            <strong>{strength.title}</strong>
            <p>{strength.detail}</p>
          </div>
        ))}
      </article>

      <article className="card">
        <h2>Recommendations</h2>
        {AREA_ORDER.every((area) => !record.recommendations.some((item) => item.area === area)) ? (
          <p className="fine">No extra recommendations were returned.</p>
        ) : null}
        {AREA_ORDER.map((area) => {
          const advice = record.recommendations.filter((item) => item.area === area);
          if (advice.length === 0) return null;
          return (
            <div key={area}>
              <h3>{AREA_LABELS[area]}</h3>
              <ul>
                {advice.map((item) => (
                  <li key={item.advice}>{item.advice}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </article>

      <article className="card stack">
        <h2>Application email</h2>
        {error ? (
          <div className="banner danger">
            <strong>Email draft unavailable</strong>
            <p>{error}</p>
          </div>
        ) : null}
        <label className="field">
          <span>Subject</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            onBlur={() => persistEmail(subject, body)}
          />
        </label>
        <label className="field">
          <span>Email</span>
          <textarea rows={12} value={body} onChange={(event) => setBody(event.target.value)} onBlur={() => persistEmail(subject, body)} />
        </label>
        <div className="row wrap">
          <button className="btn ghost" type="button" onClick={() => void copyEmail()}>
            <Copy size={16} /> Copy
          </button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => void regenerate()}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Regenerate email
          </button>
          <button className="btn ghost" type="button" onClick={() => void download()}>
            <Download size={16} /> Download PDF
          </button>
          {mail ? (
            <a className="btn primary" href={mail}>
              <Mail size={16} /> Open in email
            </a>
          ) : null}
        </div>
        {mail ? null : <p className="fine">This email is too long to open in a mail app. Copy it instead.</p>}
      </article>
    </section>
  );
}
