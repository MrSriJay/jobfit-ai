import { ArrowLeft, Briefcase, Copy, Download, ExternalLink, LoaderCircle, Mail, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { regenerateEmail } from "../api";
import { FlowTip } from "../components/Tooltip";
import { buildReportPdf, downloadPdf, safeFilename } from "../pdf";
import { useStore } from "../state";
import { dismissTip } from "../tips";
import { bandLabel, usePreferences } from "../preferences";
import { AREA_ORDER, CRITERIA, type AnalysisRecord, type Criterion } from "../types";

const MAILTO_LIMIT = 1800;
const SECTION_IDS = ["overview", "scores", "skills", "advice"] as const;

type SectionId = (typeof SECTION_IDS)[number];

function mailto(subject: string, body: string): string | null {
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return url.length > MAILTO_LIMIT ? null : url;
}

function sectionLabel(id: SectionId, labels: { overview: string; scoresTab: string; skillsTab: string; adviceTab: string }): string {
  if (id === "overview") return labels.overview;
  if (id === "scores") return labels.scoresTab;
  if (id === "skills") return labels.skillsTab;
  return labels.adviceTab;
}

export function ResultsPage() {
  const { snapshot, replaceAnalysis, selectAnalysis, notify } = useStore();
  const { m } = usePreferences();
  const [params] = useSearchParams();
  const record = snapshot.history.find((item) => item.id === params.get("id")) ?? null;

  if (!record) {
    return (
      <section className="page">
        <h1>{m.analysis.title}</h1>
        {snapshot.history.length === 0 ? (
          <div className="empty">
            <Sparkles size={18} />
            <div>
              <strong>{m.analysis.emptyTitle}</strong>
              <p>{m.analysis.emptyText}</p>
            </div>
          </div>
        ) : (
          <FlowTip id="history" block label={m.analysis.tipHistory}>
            <div className="analysis-list">
              {snapshot.history.map((item) => {
                const company = item.job.company.trim();
                return (
                  <Link key={item.id} to={`/analysis?id=${encodeURIComponent(item.id)}`} onClick={() => selectAnalysis(item.id)}>
                    <span className="analysis-icon" aria-hidden="true">
                      <Briefcase size={18} />
                    </span>
                    <span className="analysis-copy">
                      <strong>{item.job.title || m.analysis.untitled}</strong>
                      <small>
                        {company || m.analysis.noCompany} · {item.createdAt.slice(0, 10)}
                      </small>
                    </span>
                    <span className="analysis-result">
                      <strong>
                        {item.score}
                        <span>/100</span>
                      </strong>
                      <small>{bandLabel(item.classification, m.bands)}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </FlowTip>
        )}
      </section>
    );
  }

  return <Report key={record.id} record={record} onChange={replaceAnalysis} notify={notify} />;
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
  const { m, fill } = usePreferences();
  const [tab, setTab] = useState<SectionId>("overview");
  const company = record.job.company.trim();
  const heading = company ? `${record.job.title} at ${company}` : record.job.title;
  const mail = mailto(subject, body);
  const posting = /^https?:\/\//i.test(record.job.url.trim()) ? record.job.url.trim() : "";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setScore(record.score));
    return () => window.cancelAnimationFrame(frame);
  }, [record.score]);

  useEffect(() => {
    const marker = 150;
    const onScroll = () => {
      let current: SectionId = "overview";
      for (const id of SECTION_IDS) {
        const node = document.getElementById(id);
        if (node && node.getBoundingClientRect().top <= marker) current = id;
      }
      setTab(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const jumpTo = (id: SectionId) => {
    dismissTip("analysis");
    setTab(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      notify(m.analysis.copied);
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
      notify(m.analysis.updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : m.analysis.emailFailed);
    } finally {
      setBusy(false);
    }
  };

  const verdictClass =
    record.apply.verdict === "worth_applying" ? "ok" : record.apply.verdict === "low_priority" ? "warn" : "info";

  return (
    <section className="page analysis-page">
      <header className="analysis-head">
        <div className="analysis-title">
          <div className="analysis-heading">
            <Link className="back-link" to="/analysis">
              <ArrowLeft size={15} /> {m.analysis.back}
            </Link>
            <h1>{m.analysis.title}</h1>
          </div>
        </div>
      </header>
      <div className="analysis-main">
      <div className="card report-hero">
        <div className="score-hero">
          <div className="ring" style={{ ["--p" as string]: score }} aria-label={fill(m.analysis.scoreAria, { score: record.score })}>
            <strong>{record.score}</strong>
            <span>{m.analysis.outOf}</span>
          </div>
          <div>
            <p className="band">{bandLabel(record.classification, m.bands)}</p>
            <h2>{heading}</h2>
            <p className="fine">{record.createdAt.replace("T", " ").replace("Z", " UTC")}</p>
            {posting ? (
              <a className="text-link" href={posting} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> {m.analysis.posting}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <FlowTip id="analysis" block label={m.analysis.tipTabs}>
      <div className="tabs jump-tabs" role="tablist" aria-label={m.analysis.sections}>
        {SECTION_IDS.map((id) => (
          <button key={id} className={tab === id ? "active" : ""} type="button" role="tab" aria-selected={tab === id} onClick={() => jumpTo(id)}>
            {sectionLabel(id, m.analysis)}
          </button>
        ))}
      </div>
      </FlowTip>

      <div id="overview" className="report-section">
        <div className={`banner ${verdictClass}`}>
          <strong>{m.verdict[record.apply.verdict]}</strong>
          <p>{record.apply.explanation}</p>
        </div>
        <article className="card">
          <h2>{m.analysis.summary}</h2>
          <p>{record.summary}</p>
        </article>
      </div>

      <article id="scores" className="card report-section">
        <h2>{m.analysis.scores}</h2>
        <ul className="bars">
          {record.categories.map((category) => {
            const label = CRITERIA.find((item) => item.key === category.criterion);
            return (
              <li key={category.criterion}>
                <div>
                  <span>{m.criteria[category.criterion as Criterion]}</span>
                  <strong>{category.score}</strong>
                </div>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${category.score}%` }} />
                </div>
                <small>{label?.weight} {m.analysis.ofTotal}</small>
              </li>
            );
          })}
        </ul>
        <details className="preview">
          <summary>{m.analysis.how}</summary>
          <p>{m.analysis.howBody}</p>
          <ul className="plain">
            {CRITERIA.map((item) => (
              <li key={item.key}>
                {m.criteria[item.key]} · {item.weight}
              </li>
            ))}
          </ul>
          <p className="fine">{m.analysis.bandLine}</p>
        </details>
        {record.categories.map((category) => {
          return (
            <details key={`${category.criterion}-note`} className="note">
              <summary>
                {m.criteria[category.criterion as Criterion]} · {category.score}/100
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

      <div id="skills" className="report-section">
      <article className="card">
        <h2>{m.analysis.matched}</h2>
        {record.matchedSkills.length === 0 ? (
          <p className="fine">{m.analysis.noMatched}</p>
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
        <h2>{m.analysis.gaps}</h2>
        {record.gaps.length === 0 ? <p className="fine">{m.analysis.noGaps}</p> : null}
        {record.gaps.map((gap) => (
          <div key={`${gap.skill}-${gap.status}`} className="note-card">
            <strong>{gap.skill}</strong>
            <p className="fine">{m.gap[gap.status]}</p>
            <p>{gap.explanation}</p>
          </div>
        ))}
      </article>
      </div>

      <div id="advice" className="report-section">
      <article className="card">
        <h2>{m.analysis.strengths}</h2>
        {record.strengths.length === 0 ? <p className="fine">{m.analysis.noStrengths}</p> : null}
        {record.strengths.map((strength) => (
          <div key={strength.title} className="note-card">
            <strong>{strength.title}</strong>
            <p>{strength.detail}</p>
          </div>
        ))}
      </article>

      <article className="card">
        <h2>{m.analysis.recommendations}</h2>
        {AREA_ORDER.every((area) => !record.recommendations.some((item) => item.area === area)) ? (
          <p className="fine">{m.analysis.noRecommendations}</p>
        ) : null}
        {AREA_ORDER.map((area) => {
          const advice = record.recommendations.filter((item) => item.area === area);
          if (advice.length === 0) return null;
          return (
            <div key={area}>
              <h3>{m.area[area]}</h3>
              <ul>
                {advice.map((item) => (
                  <li key={item.advice}>{item.advice}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </article>
      </div>
      </div>

      <aside className="card draft-email" aria-label={m.analysis.draft}>
        <FlowTip id="email" label={m.analysis.tipEmail}>
          <h2>{m.analysis.draft}</h2>
        </FlowTip>
        {error ? (
          <div className="banner danger">
            <strong>{m.analysis.draftFail}</strong>
            <p>{error}</p>
          </div>
        ) : null}
        <label className="field">
          <span>{m.analysis.subject}</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            onBlur={() => persistEmail(subject, body)}
          />
        </label>
        <label className="field draft-body">
          <span>{m.analysis.email}</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} onBlur={() => persistEmail(subject, body)} />
        </label>
        <div className="draft-actions">
          <button className="btn ghost" type="button" onClick={() => void copyEmail()}>
            <Copy size={16} /> {m.analysis.copy}
          </button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => void regenerate()}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} {m.analysis.regenerate}
          </button>
          <button className="btn ghost wide" type="button" onClick={() => void download()}>
            <Download size={16} /> {m.analysis.download}
          </button>
          {mail ? (
            <a className="btn primary wide" href={mail}>
              <Mail size={16} /> {m.analysis.openMail}
            </a>
          ) : (
            <p className="fine wide">{m.analysis.tooLong}</p>
          )}
        </div>
      </aside>
    </section>
  );
}
