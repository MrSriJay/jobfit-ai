import { History, Info, MessageSquare, Shield, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";

import { usePreferences } from "../preferences";
import { useStore } from "../state";
import { useOpenAbout } from "./AboutDialog";
import { Tooltip } from "./Tooltip";

export function SettingsMenu({ trigger }: { trigger: ReactNode }) {
  const { snapshot, selectAnalysis, clearAll } = useStore();
  const { m } = usePreferences();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const openAbout = useOpenAbout();
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

  const profileLabel = profile?.name ? profile.name : profile ? m.profile.named : m.profile.unnamed;

  return (
    <div className="settings-wrap" ref={wrapRef}>
      <span onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={panelId}>
        {trigger}
      </span>
      {open ? (
        <div className="panel" id={panelId} role="dialog" aria-label="Settings">
          <p className="panel-kicker">
            <UserRound size={15} /> {m.menu.profile}
          </p>
          <p className="panel-copy">{profileLabel}</p>
          {snapshot.cvFilename ? <p className="panel-meta">{snapshot.cvFilename}</p> : null}

          <p className="panel-kicker gold">
            <History size={15} /> {m.menu.analyses}
          </p>
          {snapshot.history.length === 0 ? (
            <p className="panel-copy">{m.menu.analysesEmpty}</p>
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
                    {item.score}% · {item.job.title || m.menu.untitled}
                  </strong>
                  <span>{item.job.company || m.menu.noCompany}</span>
                </button>
              ))}
            </div>
          )}

          <Link className="btn ghost about-launch" to="/settings" onClick={() => setOpen(false)}>
            <SlidersHorizontal size={16} /> {m.menu.settings}
          </Link>
          <Link className="btn ghost about-launch" to="/settings?tab=feedback" onClick={() => setOpen(false)}>
            <MessageSquare size={16} /> {m.feedback.title}
          </Link>

          <button
            className="btn ghost about-launch"
            type="button"
            onClick={() => {
              setOpen(false);
              openAbout();
            }}
          >
            <Info size={16} /> {m.menu.about}
          </button>

          <Tooltip label={m.menu.tip}>
            <button
              className="btn danger"
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
            >
              <Trash2 size={16} /> {m.menu.clear}
            </button>
          </Tooltip>
          <p className="panel-note">
            <Shield size={14} /> {m.menu.note}
          </p>
        </div>
      ) : null}

      {confirming
        ? createPortal(
            <div className="modal-back" role="presentation" onClick={() => setConfirming(false)}>
              <div className="modal" role="dialog" aria-labelledby="clear-title" onClick={(event) => event.stopPropagation()}>
                <h2 id="clear-title">{m.menu.clearTitle}</h2>
                <p>{m.menu.clearBody}</p>
                <div className="row">
                  <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>
                    {m.menu.cancel}
                  </button>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={() => {
                      setConfirming(false);
                      clearAll();
                    }}
                  >
                    <Trash2 size={16} /> {m.menu.confirm}
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
