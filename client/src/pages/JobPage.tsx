import { Link2, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { analyzeJob, fetchJobFromUrl } from "../api";
import { FlowTip } from "../components/Tooltip";
import { ownCredentialsReady, usePreferences } from "../preferences";
import { useStore } from "../state";
import { dismissTip } from "../tips";
import type { JobPosting } from "../types";

const emptyJob = (): JobPosting => ({ company: "", title: "", description: "", url: "" });

function normalizeJobUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function JobPage() {
  const { snapshot, setDraft, rememberAnalysis, configured, allowBuiltin } = useStore();
  const { prefs, m, fill } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const fresh = Boolean((location.state as { fresh?: boolean } | null)?.fresh);
  const [job, setJob] = useState<JobPosting>(fresh ? emptyJob() : snapshot.draftJob ?? emptyJob());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filling, setFilling] = useState(false);
  const [status, setStatus] = useState("");
  const fillRequest = useRef(0);
  const profile = snapshot.profile;

  const cleared = useRef(false);
  useEffect(() => {
    if (!fresh || cleared.current) return;
    cleared.current = true;
    setJob(emptyJob());
    setDraft(null);
    navigate("/job", { replace: true, state: null });
  }, [fresh, navigate, setDraft]);

  const update = (next: JobPosting) => {
    setJob(next);
    const filled = next.company || next.title || next.description || next.url;
    setDraft(filled ? next : null);
  };

  const fillFromUrl = async (raw: string) => {
    const url = normalizeJobUrl(raw);
    if (!/^https?:\/\//i.test(url)) {
      setError(m.job.urlInvalid);
      setStatus("");
      return;
    }
    const request = fillRequest.current + 1;
    fillRequest.current = request;
    setFilling(true);
    setError("");
    setStatus(m.job.filling);
    try {
      const filled = await fetchJobFromUrl(url);
      if (request !== fillRequest.current) return;
      if (filled.description.trim().length < 40) {
        setStatus("");
        setError(m.job.urlEmpty);
        return;
      }
      let nextJob = job;
      setJob((current) => {
        nextJob = {
          ...current,
          url,
          company: filled.company || current.company,
          title: filled.title || current.title,
          description: filled.description,
        };
        return nextJob;
      });
      setDraft(nextJob.company || nextJob.title || nextJob.description || nextJob.url ? nextJob : null);
      setStatus(m.job.urlFilled);
    } catch (caught) {
      if (request !== fillRequest.current) return;
      setStatus("");
      setError(caught instanceof Error ? caught.message : m.job.urlFailed);
    } finally {
      if (request === fillRequest.current) setFilling(false);
    }
  };

  const analyze = async () => {
    if (!profile) return;
    if (!job.title.trim() || job.description.trim().length < 40) {
      setError(m.job.tooShort);
      return;
    }
    if ((!allowBuiltin || prefs.useOwnKey) && !ownCredentialsReady({ ...prefs, useOwnKey: true })) {
      setError(m.upload.ownKeyBody);
      return;
    }
    dismissTip("job");
    setBusy(true);
    setError("");
    setStatus(m.job.comparing);
    try {
      const record = await analyzeJob(profile, job);
      setStatus(record.emailError ? m.job.emailRetry : m.job.ready);
      rememberAnalysis(record);
      navigate(`/analysis?id=${encodeURIComponent(record.id)}`);
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : m.job.failed);
    } finally {
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <section className="page">
        <h1>{m.job.title}</h1>
        <div className="empty">
          <Upload size={18} />
          <div>
            <strong>{m.job.emptyTitle}</strong>
            <p>{m.job.emptyText}</p>
          </div>
        </div>
        <Link className="btn primary" to="/upload">
          <Upload size={16} /> {m.job.goUpload}
        </Link>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>{m.job.title}</h1>
      <p className="lede">{profile.name ? fill(m.job.usingNamed, { name: profile.name }) : m.job.using}</p>
      <Link className="text-link" to="/upload">
        {m.job.edit}
      </Link>

      {allowBuiltin && configured === "missing" && !prefs.useOwnKey ? (
        <div className="banner danger">
          <strong>{m.upload.keyTitle}</strong>
          <p>{m.upload.keyBody}</p>
        </div>
      ) : null}
      {error ? (
        <div className="banner danger">
          <strong>{m.job.neededTitle}</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="card stack">
        <label className="field">
          <span>{m.job.url}</span>
          <div className="url-row">
            <input
              value={job.url}
              placeholder="https://"
              onChange={(event) => update({ ...job, url: event.target.value })}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text").trim();
                if (!text) return;
                event.preventDefault();
                const url = normalizeJobUrl(text);
                update({ ...job, url });
                void fillFromUrl(url);
              }}
            />
            <button className="btn ghost" type="button" disabled={busy || filling || !job.url.trim()} onClick={() => void fillFromUrl(job.url)}>
              {filling ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />}
              {m.job.fill}
            </button>
          </div>
          <small>{m.job.urlHint}</small>
        </label>
        <div className="grid-2">
          <label className="field">
            <span>{m.job.company}</span>
            <input value={job.company} placeholder={m.job.optional} onChange={(event) => update({ ...job, company: event.target.value })} />
          </label>
          <label className="field">
            <span>{m.job.jobTitle}</span>
            <input value={job.title} onChange={(event) => update({ ...job, title: event.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>{m.job.description}</span>
          <textarea
            rows={12}
            value={job.description}
            placeholder={m.job.placeholder}
            onChange={(event) => update({ ...job, description: event.target.value })}
          />
        </label>
        <p className="fine">{m.job.fine}</p>
        {status ? <p className="status-line">{busy || filling ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} {status}</p> : null}
        <FlowTip id="job" block above label={m.job.tip}>
          <button className="btn primary wide" type="button" disabled={busy || filling} onClick={() => void analyze()}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
            {m.job.analyze}
          </button>
        </FlowTip>
      </div>
    </section>
  );
}
