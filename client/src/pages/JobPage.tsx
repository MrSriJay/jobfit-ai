import { ImagePlus, Link2, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { analyzeJob, fetchJobFromImage, fetchJobFromUrl } from "../api";
import { FlowTip } from "../components/Tooltip";
import { ownCredentialsReady, usePreferences } from "../preferences";
import { useStore } from "../state";
import { dismissTip } from "../tips";
import type { JobPosting } from "../types";

const emptyJob = (): JobPosting => ({ company: "", title: "", description: "", url: "" });
const imageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const maxImageBytes = 8 * 1024 * 1024;

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
  const [source, setSource] = useState<"link" | "image">("link");
  const [fillMode, setFillMode] = useState<"" | "url" | "image">("");
  const [imageName, setImageName] = useState("");
  const [status, setStatus] = useState("");
  const fillRequest = useRef(0);
  const imageInput = useRef<HTMLInputElement>(null);
  const filling = fillMode !== "";
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

  const applyFilled = (
    filled: { company: string; title: string; description: string },
    patch: Partial<JobPosting>,
    emptyMessage: string,
    filledMessage: string,
  ) => {
    if (filled.description.trim().length < 40) {
      setStatus("");
      setError(emptyMessage);
      return;
    }
    let nextJob = job;
    setJob((current) => {
      nextJob = {
        ...current,
        ...patch,
        company: filled.company || current.company,
        title: filled.title || current.title,
        description: filled.description,
      };
      return nextJob;
    });
    setDraft(nextJob.company || nextJob.title || nextJob.description || nextJob.url ? nextJob : null);
    setStatus(filledMessage);
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
    setFillMode("url");
    setError("");
    setStatus(m.job.filling);
    try {
      const filled = await fetchJobFromUrl(url);
      if (request !== fillRequest.current) return;
      applyFilled(filled, { url }, m.job.urlEmpty, m.job.urlFilled);
    } catch (caught) {
      if (request !== fillRequest.current) return;
      setStatus("");
      setError(caught instanceof Error ? caught.message : m.job.urlFailed);
    } finally {
      if (request === fillRequest.current) setFillMode("");
    }
  };

  const fillFromImage = async (file: File) => {
    if (!imageTypes.has(file.type) || file.size > maxImageBytes || file.size < 32) {
      setError(m.job.imageInvalid);
      setStatus("");
      return;
    }
    const request = fillRequest.current + 1;
    fillRequest.current = request;
    setSource("image");
    setImageName(file.name || m.job.imageChoose);
    setFillMode("image");
    setError("");
    setStatus(m.job.imageFilling);
    try {
      const filled = await fetchJobFromImage(file);
      if (request !== fillRequest.current) return;
      applyFilled(filled, {}, m.job.imageEmpty, m.job.imageFilled);
    } catch (caught) {
      if (request !== fillRequest.current) return;
      setStatus("");
      setError(caught instanceof Error ? caught.message : m.job.imageFailed);
    } finally {
      if (request === fillRequest.current) setFillMode("");
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

      <div
        className="card stack"
        onPaste={(event) => {
          const image = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
          if (!image || busy || filling) return;
          event.preventDefault();
          void fillFromImage(image);
        }}
      >
        <div className="tabs" role="tablist" aria-label={m.job.title}>
          <button className={source === "link" ? "active" : ""} type="button" role="tab" aria-selected={source === "link"} onClick={() => setSource("link")}>
            <Link2 size={16} /> {m.job.url}
          </button>
          <button className={source === "image" ? "active" : ""} type="button" role="tab" aria-selected={source === "image"} onClick={() => setSource("image")}>
            <ImagePlus size={16} /> {m.job.image}
          </button>
        </div>
        {source === "link" ? (
          <label className="field">
            <div className="url-row">
              <input
                value={job.url}
                placeholder="https://"
                onChange={(event) => update({ ...job, url: event.target.value })}
                onPaste={(event) => {
                  if ([...event.clipboardData.files].some((item) => item.type.startsWith("image/"))) return;
                  const text = event.clipboardData.getData("text").trim();
                  if (!text) return;
                  event.preventDefault();
                  const url = normalizeJobUrl(text);
                  update({ ...job, url });
                  void fillFromUrl(url);
                }}
              />
              <button className="btn ghost" type="button" disabled={busy || filling || !job.url.trim()} onClick={() => void fillFromUrl(job.url)}>
                {fillMode === "url" ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />}
                {m.job.fill}
              </button>
            </div>
            <small>{m.job.urlHint}</small>
          </label>
        ) : (
          <div className="field">
            <div className="url-row">
              <label className="file-slot">
                <ImagePlus size={16} />
                <span className={imageName ? "chosen" : ""}>{imageName || m.job.imageChoose}</span>
                <input
                  ref={imageInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void fillFromImage(file);
                  }}
                />
              </label>
              <button className="btn ghost" type="button" disabled={busy || filling} onClick={() => imageInput.current?.click()}>
                {fillMode === "image" ? <LoaderCircle className="spin" size={16} /> : <ImagePlus size={16} />}
                {m.job.imageFill}
              </button>
            </div>
            <small>{m.job.imageHint}</small>
          </div>
        )}
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
