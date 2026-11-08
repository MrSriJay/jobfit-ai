import { History, Shield, Trash2, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { useStore } from "../state";
import { Tooltip } from "./Tooltip";

export function SettingsMenu({ trigger }: { trigger: ReactNode }) {
  const { snapshot, selectAnalysis, clearAll } = useStore();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const profile = snapshot.profile;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const profileLabel = profile?.name
    ? profile.name
    : profile
      ? "A CV profile is saved in this browser."
      : "No CV profile saved yet.";

  return (
    <div className="settings-wrap" ref={wrapRef}>
      <span onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={panelId}>
        {trigger}
      </span>
      {open ? (
        <div className="panel" id={panelId} role="dialog" aria-label="Settings">
          <p className="panel-kicker">
            <UserRound size={15} /> Profile
          </p>
          <p className="panel-copy">{profileLabel}</p>
          {snapshot.cvFilename ? <p className="panel-meta">{snapshot.cvFilename}</p> : null}

          <p className="panel-kicker gold">
            <History size={15} /> Saved analyses
          </p>
          {snapshot.history.length === 0 ? (
            <p className="panel-copy">Saved analyses appear here after you run a match.</p>
          ) : (
            <div className="history-list">
              {snapshot.history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === snapshot.currentAnalysisId ? "history-item current" : "history-item"}
                  onClick={() => {
                    selectAnalysis(item.id);
                    setOpen(false);
                    navigate("/analysis");
                  }}
                >
                  <strong>
                    {item.score}% · {item.job.title || "Untitled role"}
                  </strong>
                  <span>{item.job.company || "No company"}</span>
                </button>
              ))}
            </div>
          )}

          <Tooltip label="Clears the saved CV, job draft, and match history in this browser. It does not delete anything from OpenAI.">
            <button
              className="btn danger"
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
            >
              <Trash2 size={16} /> Clear local data
            </button>
          </Tooltip>
          <p className="panel-note">
            <Shield size={14} /> Profiles and reports stay in this browser. CV text and job descriptions are sent to OpenAI only when you extract, analyze, or regenerate an email.
          </p>
        </div>
      ) : null}

      {confirming
        ? createPortal(
            <div className="modal-back" role="presentation" onClick={() => setConfirming(false)}>
              <div className="modal" role="dialog" aria-labelledby="clear-title" onClick={(event) => event.stopPropagation()}>
                <h2 id="clear-title">Clear local data</h2>
                <p>This removes the CV profile, job draft, and analysis history stored in this browser.</p>
                <div className="row">
                  <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={() => {
                      clearAll();
                      setConfirming(false);
                      navigate("/upload");
                    }}
                  >
                    <Trash2 size={16} /> Clear data
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
