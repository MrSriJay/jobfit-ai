import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";

import { apiKeyCheck } from "./api";
import { AboutProvider, useOpenAbout } from "./components/AboutDialog";
import { AppBackground } from "./components/AppBackground";
import { FeedbackDialog } from "./components/FeedbackForm";
import { TopBar } from "./components/TopBar";
import { JobPage } from "./pages/JobPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadPage } from "./pages/UploadPage";
import { WelcomePage } from "./pages/WelcomePage";
import { ownCredentialsReady, PreferencesProvider, usePreferences } from "./preferences";
import { StoreProvider, useStore } from "./state";

let launchWarningShown = false;

export function App() {
  return (
    <StoreProvider>
      <PreferencesProvider>
      <BrowserRouter>
        <AboutProvider>
          <div className="shell">
            <AppBackground />
            <TopBar />
            <main>
              <Routes>
                <Route path="/" element={<WelcomePage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/job" element={<JobPage />} />
                <Route path="/analysis" element={<ResultsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
            <SiteFoot />
            <KeySetupWarning />
          </div>
        </AboutProvider>
      </BrowserRouter>
      </PreferencesProvider>
    </StoreProvider>
  );
}

type KeyMark = "checking" | "yes" | "no" | "unknown";

function useKeyMarks(): { configured: KeyMark; working: KeyMark } {
  const { configured, allowBuiltin } = useStore();
  const { prefs } = usePreferences();
  const [marks, setMarks] = useState<{ configured: KeyMark; working: KeyMark }>({
    configured: "checking",
    working: "checking",
  });

  useEffect(() => {
    if (configured === "loading") return;
    const usingOwn = !allowBuiltin || prefs.useOwnKey;
    const ready = usingOwn ? ownCredentialsReady({ ...prefs, useOwnKey: true }) : configured === "ready";
    if (!ready) {
      if (configured === "offline" && !usingOwn) {
        setMarks({ configured: "unknown", working: "unknown" });
        return;
      }
      setMarks({ configured: "no", working: "no" });
      return;
    }

    let cancelled = false;
    setMarks({ configured: "yes", working: "checking" });
    apiKeyCheck(usingOwn)
      .then((result) => {
        if (cancelled) return;
        setMarks({
          configured: result.configured ? "yes" : "no",
          working: result.working ? "yes" : "no",
        });
      })
      .catch(() => {
        if (!cancelled) setMarks({ configured: "yes", working: "unknown" });
      });
    return () => {
      cancelled = true;
    };
  }, [allowBuiltin, configured, prefs.useOwnKey, prefs.apiKey, prefs.model]);

  return marks;
}

function tagClass(mark: KeyMark): string {
  if (mark === "yes") return "foot-tag ok";
  if (mark === "no") return "foot-tag bad";
  return "foot-tag wait";
}

function SiteFoot() {
  const openAbout = useOpenAbout();
  const { allowBuiltin } = useStore();
  const { prefs, m } = usePreferences();
  const marks = useKeyMarks();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const usingOwn = !allowBuiltin || prefs.useOwnKey;
  const unreachable = usingOwn ? m.footer.notChecked : m.footer.notConnected;
  const configuredLabel =
    marks.configured === "yes" ? m.footer.configured : marks.configured === "no" ? m.footer.notConfigured : marks.configured === "checking" ? m.footer.checking : unreachable;
  const workingLabel =
    marks.working === "yes" ? m.footer.working : marks.working === "no" ? (usingOwn ? m.footer.notWorking : m.footer.notConnected) : marks.working === "checking" ? m.footer.checking : unreachable;
  return (
    <footer className="site-foot">
      <div className="foot-tags" role="status">
        <span className={tagClass(marks.configured)}>{configuredLabel}</span>
        <span className={tagClass(marks.working)}>{workingLabel}</span>
      </div>
      <p>
        {m.footer.text}{" "}
        <button className="foot-link" type="button" onClick={openAbout}>
          {m.footer.about}
        </button>
      </p>
      <div className="foot-feedback">
        <button className="btn ghost" type="button" onClick={() => setFeedbackOpen(true)}>
          <MessageSquare size={15} /> {m.feedback.title}
        </button>
      </div>
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  );
}

function KeySetupWarning() {
  const { allowBuiltin, configured } = useStore();
  const { prefs, m } = usePreferences();
  const navigate = useNavigate();
  const needsKey = configured !== "loading" && configured !== "offline" && !allowBuiltin && !ownCredentialsReady({ ...prefs, useOwnKey: true });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!needsKey) {
      setOpen(false);
      return;
    }
    if (launchWarningShown) return;
    launchWarningShown = true;
    setOpen(true);
  }, [needsKey]);

  useEffect(() => {
    const reopen = () => {
      if (!needsKey) {
        launchWarningShown = false;
        return;
      }
      launchWarningShown = true;
      setOpen(true);
    };
    window.addEventListener("jobfit-key-warn", reopen);
    return () => window.removeEventListener("jobfit-key-warn", reopen);
  }, [needsKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-back" role="presentation" onClick={() => setOpen(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="key-setup-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="key-setup-title">{m.keySetup.title}</h2>
        <p>{m.keySetup.body}</p>
        <p>{m.keySetup.secure}</p>
        <div className="row">
          <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
            {m.keySetup.later}
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
          >
            {m.keySetup.setup}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
