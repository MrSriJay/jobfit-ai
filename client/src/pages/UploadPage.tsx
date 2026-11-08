import { ArrowRight, FileText, FileUp, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { extractProfile, parseCv } from "../api";
import { ProfileForm } from "../components/ProfileForm";
import { Tooltip } from "../components/Tooltip";
import { useStore } from "../state";
import { dismissTips, useFirstVisit } from "../tips";

const MAX_BYTES = 10 * 1024 * 1024;

export function UploadPage() {
  const { configured, snapshot, profileNonce, saveProfile, clearCv, notify } = useStore();
  const firstVisit = useFirstVisit();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<"parse" | "extract" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [parsed, setParsed] = useState<{ filename: string; characters: number; preview: string; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const takeFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setNotice("");
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 10 MB.");
      return;
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError(name.endsWith(".doc") ? "Save the CV as DOCX or PDF and upload that file." : "Upload a PDF or DOCX file.");
      return;
    }
    setBusy("parse");
    try {
      setParsed(await parseCv(file));
    } catch (caught) {
      setParsed(null);
      setError(caught instanceof Error ? caught.message : "The file could not be read.");
    } finally {
      setBusy(null);
    }
  };

  const extract = async () => {
    if (!parsed) return;
    setBusy("extract");
    setError("");
    setNotice("");
    try {
      const result = await extractProfile(parsed.text);
      saveProfile(result.profile, parsed.filename);
      if (result.truncated) setNotice("The CV was shortened before extraction. Review the profile for missing sections.");
      else if (result.fromCache) setNotice("This CV text was already extracted in this session.");
      else setNotice("Review the profile, then save any edits.");
      notify("Profile extracted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The profile could not be extracted.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="page">
      <p className="eyebrow">Step 1</p>
      <h1>Upload CV</h1>
      <p className="lede">Add a PDF or DOCX resume once. Later job checks reuse the saved profile.</p>
      {firstVisit ? (
        <div className="coach">
          <strong>First time here</strong>
          <p>Drop a text-based PDF or DOCX in the box. Extract sends that text to OpenAI, then the profile stays in this browser.</p>
          <p>The gear at the top right holds saved matches. Clear local data removes them from this browser only.</p>
          <button className="btn ghost" type="button" onClick={dismissTips}>
            Got it
          </button>
        </div>
      ) : null}

      {configured === "missing" ? (
        <div className="banner danger">
          <strong>OpenAI API key required</strong>
          <p>Add OPENAI_API_KEY to the .env file in the project folder, then restart the server.</p>
        </div>
      ) : null}
      {configured === "offline" ? (
        <div className="banner danger">
          <strong>API server is not running</strong>
          <p>Start the app with npm run dev so CV files can be read.</p>
        </div>
      ) : null}
      {error ? (
        <div className="banner danger">
          <strong>Could not continue</strong>
          <p>{error}</p>
        </div>
      ) : null}
      {notice ? (
        <div className="banner ok">
          <strong>Profile ready</strong>
          <p>{notice}</p>
        </div>
      ) : null}

      {snapshot.profile ? null : (
        <>
          <label
            className={over ? "drop over" : "drop"}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              void takeFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                void takeFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <span className="drop-icon">
              {busy === "parse" ? <LoaderCircle className="spin" size={28} /> : <FileUp size={28} />}
            </span>
            <strong>{over ? "Release to read the CV" : "Drop your CV here"}</strong>
            <span>or click to browse · PDF or DOCX · 10 MB</span>
          </label>

          {parsed ? (
            <div className="card file-card">
              <div>
                <strong>{parsed.filename}</strong>
                <p>{parsed.characters.toLocaleString()} characters</p>
              </div>
              <button className="btn primary" type="button" disabled={busy !== null} onClick={() => void extract()}>
                {busy === "extract" ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                Extract profile
              </button>
            </div>
          ) : null}
          {parsed ? (
            <details className="preview">
              <summary>Text preview</summary>
              <pre>{parsed.preview || "No text."}</pre>
            </details>
          ) : null}
          <p className="fine">Extracting a profile sends the CV text to OpenAI. The profile is then saved in this browser, not in an application database.</p>
        </>
      )}

      {snapshot.profile ? (
        <div className="card">
          <div className="profile-head">
            <div>
              <h2>Saved profile</h2>
              {snapshot.cvFilename ? (
                <p className="profile-file">
                  <FileText size={15} aria-hidden="true" />
                  <span>{snapshot.cvFilename}</span>
                </p>
              ) : null}
            </div>
            <Tooltip label="Delete this CV and the saved profile">
              <button className="icon-button danger" type="button" aria-label="Delete CV" onClick={() => setConfirming(true)}>
                <Trash2 size={16} />
              </button>
            </Tooltip>
          </div>
          <ProfileForm
            key={profileNonce}
            profile={snapshot.profile}
            onSave={(profile) => {
              saveProfile(profile);
              notify("Profile saved");
            }}
            next={
              <Link className="btn primary" to="/job">
                Next <ArrowRight size={16} />
              </Link>
            }
          />
        </div>
      ) : (
        <div className="empty">
          <Sparkles size={18} />
          <div>
            <strong>No profile yet</strong>
            <p>Upload a CV to create a profile you can reuse for every job.</p>
          </div>
        </div>
      )}
      {confirming
        ? createPortal(
            <div className="modal-back" role="presentation" onClick={() => setConfirming(false)}>
              <div className="modal" role="dialog" aria-labelledby="delete-cv-title" onClick={(event) => event.stopPropagation()}>
                <h2 id="delete-cv-title">Delete this CV?</h2>
                <p>This removes the saved CV and the profile from this browser. Match history stays until you clear local data.</p>
                <div className="row">
                  <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={() => {
                      clearCv();
                      setParsed(null);
                      setNotice("");
                      setConfirming(false);
                    }}
                  >
                    <Trash2 size={16} /> Delete CV
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
