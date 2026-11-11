import { Check, LoaderCircle, MessageSquare, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { sendFeedback } from "../feedback";
import { usePreferences } from "../preferences";

export function FeedbackForm({ hint = true }: { hint?: boolean }) {
  const { m } = usePreferences();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honey, setHoney] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (text.length < 8) {
      setStatus("");
      setError(m.feedback.short);
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus("");
      setError(m.feedback.emailInvalid);
      return;
    }
    setBusy(true);
    setError("");
    setStatus(m.feedback.sending);
    try {
      if (honey.trim()) {
        setMessage("");
        setStatus(m.feedback.sent);
        return;
      }
      const result = await sendFeedback({ name, email, message: text });
      if (result === "pending") {
        setStatus("");
        setError(m.feedback.pending);
        return;
      }
      setMessage("");
      setStatus(m.feedback.sent);
    } catch {
      setStatus("");
      setError(m.feedback.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="feedback-form">
      {hint ? <p className="fine">{m.feedback.hint}</p> : null}
      <div className="grid-2">
        <label className="field">
          <span>{m.feedback.name}</span>
          <input value={name} placeholder={m.feedback.optional} autoComplete="name" onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span>{m.feedback.email}</span>
          <input value={email} placeholder={m.feedback.optional} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>{m.feedback.message}</span>
        <textarea rows={6} value={message} placeholder={m.feedback.placeholder} onChange={(event) => setMessage(event.target.value)} />
      </label>
      <div className="hp" aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" value={honey} onChange={(event) => setHoney(event.target.value)} />
      </div>
      {error ? (
        <div className="banner danger">
          <strong>{m.feedback.title}</strong>
          <p>{error}</p>
        </div>
      ) : null}
      {status ? (
        <p className={busy ? "status-line" : "feedback-sent"}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} {status}
        </p>
      ) : null}
      <button className="btn primary" type="button" disabled={busy} onClick={() => void submit()}>
        {busy ? <LoaderCircle className="spin" size={16} /> : <MessageSquare size={16} />}
        {m.feedback.send}
      </button>
    </div>
  );
}

export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { m } = usePreferences();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="modal feedback-modal" role="dialog" aria-labelledby="feedback-title" onClick={(event) => event.stopPropagation()}>
        <header className="feedback-head">
          <div>
            <h2 id="feedback-title">
              <MessageSquare size={18} aria-hidden="true" /> {m.feedback.title}
            </h2>
            <p>{m.feedback.hint}</p>
          </div>
          <button className="icon-button" type="button" aria-label={m.feedback.close} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="feedback-body">
          <FeedbackForm hint={false} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
