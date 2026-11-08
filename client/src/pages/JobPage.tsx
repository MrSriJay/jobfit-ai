import { LoaderCircle, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { analyzeJob } from "../api";
import { useStore } from "../state";
import type { JobPosting } from "../types";

const emptyJob = (): JobPosting => ({ company: "", title: "", description: "", url: "" });

export function JobPage() {
  const { snapshot, setDraft, rememberAnalysis } = useStore();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobPosting>(snapshot.draftJob ?? emptyJob());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const profile = snapshot.profile;

  const update = (next: JobPosting) => {
    setJob(next);
    const filled = next.company || next.title || next.description || next.url;
    setDraft(filled ? next : null);
  };

  const analyze = async () => {
    if (!profile) return;
    if (!job.title.trim() || job.description.trim().length < 40) {
      setError("Enter a job title and a job description of at least a few sentences.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Comparing the profile with the job description.");
    try {
      const record = await analyzeJob(profile, job);
      setStatus(record.emailError ? "Match ready. The email draft needs another try." : "Analysis ready.");
      rememberAnalysis(record);
      navigate("/analysis");
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "The match could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <section className="page">
        <p className="eyebrow">Step 2</p>
        <h1>Job description</h1>
        <div className="empty">
          <Upload size={18} />
          <div>
            <strong>CV profile needed</strong>
            <p>Upload a CV and save the extracted profile before analyzing a job.</p>
          </div>
        </div>
        <Link className="btn primary" to="/upload">
          <Upload size={16} /> Go to CV upload
        </Link>
      </section>
    );
  }

  return (
    <section className="page">
      <p className="eyebrow">Step 2</p>
      <h1>Job description</h1>
      <p className="lede">
        Using the saved profile{profile.name ? ` for ${profile.name}` : ""}. You do not upload the CV again for each job.
      </p>
      <Link className="text-link" to="/upload">
        Edit profile
      </Link>

      {error ? (
        <div className="banner danger">
          <strong>Job details needed</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="card stack">
        <div className="grid-2">
          <label className="field">
            <span>Company</span>
            <input value={job.company} placeholder="Optional" onChange={(event) => update({ ...job, company: event.target.value })} />
          </label>
          <label className="field">
            <span>Job title</span>
            <input value={job.title} onChange={(event) => update({ ...job, title: event.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Job URL</span>
          <input value={job.url} placeholder="Optional" onChange={(event) => update({ ...job, url: event.target.value })} />
        </label>
        <label className="field">
          <span>Job description</span>
          <textarea
            rows={12}
            value={job.description}
            placeholder="Paste the responsibilities, requirements, and nice-to-haves."
            onChange={(event) => update({ ...job, description: event.target.value })}
          />
        </label>
        <p className="fine">Analyzing sends this job text and your saved profile to OpenAI. It can take a minute.</p>
        {status ? <p className="status-line">{busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} {status}</p> : null}
        <button className="btn primary wide" type="button" disabled={busy} onClick={() => void analyze()}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
          Analyze job match
        </button>
      </div>
    </section>
  );
}
