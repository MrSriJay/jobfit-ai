import { ArrowRight, FileText, FileUp, LoaderCircle, PenLine, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { extractProfile, parseCv } from "../api";
import { ProfileForm } from "../components/ProfileForm";
import { FlowTip, Tooltip } from "../components/Tooltip";
import { ownCredentialsReady, usePreferences } from "../preferences";
import { useStore } from "../state";
import { dismissTip } from "../tips";
import type { CandidateProfile } from "../types";

const MAX_BYTES = 10 * 1024 * 1024;

function emptyProfile(): CandidateProfile {
  return {
    name: "",
    email: "",
    phone: [],
    location: "",
    links: [],
    professionalSummary: "",
    skills: [],
    technologies: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
  };
}

function profileHasContent(profile: CandidateProfile): boolean {
  return Boolean(
    profile.name ||
      profile.email ||
      profile.phone.length ||
      profile.location ||
      profile.links.length ||
      profile.professionalSummary ||
      profile.skills.length ||
      profile.technologies.length ||
      profile.experience.length ||
      profile.education.length ||
      profile.projects.length ||
      profile.certifications.length,
  );
}

export function UploadPage() {
  const { configured, allowBuiltin, snapshot, profileNonce, saveProfile, clearCv, notify } = useStore();
  const { prefs, m, fill } = usePreferences();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<"parse" | "extract" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [parsed, setParsed] = useState<{ filename: string; characters: number; preview: string; text: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const manualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (manual) manualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [manual]);

  const takeFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setNotice("");
    if (file.size > MAX_BYTES) {
      setError(m.upload.tooLarge);
      return;
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError(name.endsWith(".doc") ? m.upload.docHint : m.upload.typeHint);
      return;
    }
    dismissTip("upload");
    setBusy("parse");
    try {
      setParsed(await parseCv(file));
    } catch (caught) {
      setParsed(null);
      setError(caught instanceof Error ? caught.message : m.upload.readFailed);
    } finally {
      setBusy(null);
    }
  };

  const extract = async () => {
    if (!parsed) return;
    if ((!allowBuiltin || prefs.useOwnKey) && !ownCredentialsReady({ ...prefs, useOwnKey: true })) {
      setError(m.upload.ownKeyBody);
      return;
    }
    dismissTip("extract");
    setBusy("extract");
    setError("");
    setNotice("");
    try {
      const result = await extractProfile(parsed.text);
      saveProfile(result.profile, parsed.filename);
      if (result.truncated) setNotice(m.upload.reviewShort);
      else if (result.fromCache) setNotice(m.upload.reviewCached);
      else setNotice(m.upload.review);
      notify(m.upload.extracted);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : m.upload.extractFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="page">
      <h1>{m.upload.title}</h1>
      <p className="lede">{m.upload.lede}</p>

      {(allowBuiltin ? configured === "missing" && !prefs.useOwnKey : !ownCredentialsReady({ ...prefs, useOwnKey: true })) ? (
        <div className="banner danger">
          <strong>{!allowBuiltin || prefs.useOwnKey ? m.upload.ownKeyTitle : m.upload.keyTitle}</strong>
          <p>{!allowBuiltin || prefs.useOwnKey ? m.upload.ownKeyBody : m.upload.keyBody}</p>
        </div>
      ) : null}
      {configured === "offline" ? (
        <div className="banner danger">
          <strong>{m.upload.offlineTitle}</strong>
          <p>{m.upload.offlineBody}</p>
        </div>
      ) : null}
      {error ? (
        <div className="banner danger">
          <strong>{m.upload.couldNot}</strong>
          <p>{error}</p>
        </div>
      ) : null}
      {notice ? (
        <div className="banner ok">
          <strong>{m.upload.ready}</strong>
          <p>{notice}</p>
        </div>
      ) : null}

      {snapshot.profile ? (
        <div className="card">
          <div className="profile-head">
            <div>
              <h2>{m.upload.saved}</h2>
              {snapshot.cvFilename ? (
                <p className="profile-file">
                  <FileText size={15} aria-hidden="true" />
                  <span>{snapshot.cvFilename}</span>
                </p>
              ) : null}
            </div>
            <Tooltip label={snapshot.cvFilename ? m.upload.deleteCvTip : m.upload.deleteProfileTip}>
              <button className="icon-button danger" type="button" aria-label={snapshot.cvFilename ? m.upload.deleteCv : m.upload.deleteProfile} onClick={() => setConfirming(true)}>
                <Trash2 size={16} />
              </button>
            </Tooltip>
          </div>
          <ProfileForm
            key={profileNonce}
            profile={snapshot.profile}
            onSave={(profile) => {
              saveProfile(profile);
              notify(m.upload.savedToast);
            }}
            next={
              <FlowTip id="next" block label={m.upload.tipNext}>
                <Link className="btn primary" to="/job" onClick={() => dismissTip("next")}>
                  {m.upload.next} <ArrowRight size={16} />
                </Link>
              </FlowTip>
            }
          />
        </div>
      ) : (
        <div className="upload-flow">
          <FlowTip id="upload" block above label={m.upload.tipUpload}>
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
            <strong>{over ? m.upload.release : m.upload.drop}</strong>
            <span>{m.upload.browse}</span>
          </label>
          </FlowTip>

          {manual ? null : (
            <div className="manual-choice">
              <span>{m.upload.or}</span>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  dismissTip("upload");
                  setError("");
                  setManual(true);
                }}
              >
                <PenLine size={16} /> {m.upload.manual}
              </button>
            </div>
          )}

          {parsed ? (
            <div className="card file-card">
              <div>
                <strong>{parsed.filename}</strong>
                <p>{fill(m.upload.characters, { count: parsed.characters.toLocaleString() })}</p>
              </div>
              <FlowTip id="extract" label={m.upload.tipExtract}>
                <button className="btn primary" type="button" disabled={busy !== null} onClick={() => void extract()}>
                  {busy === "extract" ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                  {m.upload.extract}
                </button>
              </FlowTip>
            </div>
          ) : null}
          {parsed ? (
            <details className="preview">
              <summary>{m.upload.preview}</summary>
              <pre>{parsed.preview || m.upload.noText}</pre>
            </details>
          ) : null}
          {manual && !parsed ? null : (
            <p className="fine">{m.upload.note}</p>
          )}

          {manual ? (
        <div className="card" ref={manualRef}>
          <div className="profile-head">
            <div>
              <h2>{m.upload.manualTitle}</h2>
              <p className="profile-file">{m.upload.manualNote}</p>
            </div>
            <button className="btn ghost" type="button" onClick={() => setManual(false)}>
              {m.upload.back}
            </button>
          </div>
          <ProfileForm
            profile={emptyProfile()}
            onSave={(profile) => {
              if (!profileHasContent(profile)) {
                setError(m.upload.needContent);
                setNotice("");
                return;
              }
              setError("");
              saveProfile(profile);
              notify(m.upload.savedToast);
            }}
          />
        </div>
      ) : (
        <div className="empty">
          <Sparkles size={18} />
          <div>
            <strong>{m.upload.emptyTitle}</strong>
            <p>{m.upload.emptyText}</p>
          </div>
        </div>
          )}
        </div>
      )}
      {confirming
        ? createPortal(
            <div className="modal-back" role="presentation" onClick={() => setConfirming(false)}>
              <div className="modal" role="dialog" aria-labelledby="delete-cv-title" onClick={(event) => event.stopPropagation()}>
                <h2 id="delete-cv-title">{snapshot.cvFilename ? m.upload.deleteCvTitle : m.upload.deleteProfileTitle}</h2>
                <p>{snapshot.cvFilename ? m.upload.deleteCvBody : m.upload.deleteProfileBody}</p>
                <div className="row">
                  <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>
                    {m.upload.cancel}
                  </button>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={() => {
                      clearCv(m.upload.removed);
                      setParsed(null);
                      setNotice("");
                      setConfirming(false);
                    }}
                  >
                    <Trash2 size={16} /> {snapshot.cvFilename ? m.upload.deleteCv : m.upload.deleteProfile}
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
