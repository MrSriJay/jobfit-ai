import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const AboutContext = createContext<(() => void) | null>(null);

export function AboutProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openAbout = useMemo(() => () => setOpen(true), []);
  return (
    <AboutContext.Provider value={openAbout}>
      {children}
      {open ? <AboutDialog onClose={() => setOpen(false)} /> : null}
    </AboutContext.Provider>
  );
}

export function useOpenAbout(): () => void {
  const openAbout = useContext(AboutContext);
  if (!openAbout) throw new Error("About is unavailable.");
  return openAbout;
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="modal about-modal" role="dialog" aria-labelledby="about-title" onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">JobFit AI</p>
        <h2 id="about-title">About</h2>
        <p>
          JobFit AI compares one saved CV with a job description. Upload a resume once, then check other roles without uploading it again. The report includes a match score, matched skills, gaps, recommendations, and a draft application email.
        </p>

        <h3>Data security</h3>
        <p>
          Your CV, profile, job drafts, and match reports stay in this browser. JobFit keeps no account and no application database, so that information remains on your device and out of any public or shared store. Clearing this browser’s site data removes it.
        </p>
        <p>
          A CV is sent to OpenAI only when you extract a profile. A saved profile and a job description are sent only when you analyze a match or regenerate an email. Those requests are made with storage turned off, and the API key remains on the server.
        </p>

        <h3>Technical overview</h3>
        <p>
          The page is a local web app. It sends the CV file to a Node API, which reads the document and asks the model for a structured profile. A later request sends that profile with the job text. The model scores each category and drafts the email. The server calculates the 0–100 total.
        </p>

        <h3>Tech stack</h3>
        <ul>
          <li>React 19, TypeScript, and Vite</li>
          <li>React Router for the upload, job, and analysis steps</li>
          <li>Express API on Node, run with tsx</li>
          <li>PDF reading with unpdf, Word documents with mammoth</li>
          <li>Zod checks the model output before it is saved</li>
          <li>pdf-lib builds the downloadable report in the browser</li>
          <li>Browser storage keeps the profile, job draft, and match history on this device</li>
        </ul>

        <h3>Model</h3>
        <p>
          The default model is gpt-5.6-sol with reasoning effort set to low. It extracts the CV, scores five categories, and writes the application email. The total is a weighted sum: skills 35%, experience 25%, responsibilities 20%, seniority 10%, and education 10%. Bands run from Excellent at 85–100 down to Poor at 0–29.
        </p>

        <h3>Developer</h3>
        <p>Jayanga Palihena built JobFit AI as a local tool for comparing a CV with a role and drafting the application email.</p>
        <p>
          <a className="text-link" href="https://github.com/MrSriJay" target="_blank" rel="noreferrer">
            GitHub · MrSriJay
          </a>
        </p>
        <p>
          <a className="text-link" href="https://github.com/MrSriJay/jobfit-ai" target="_blank" rel="noreferrer">
            github.com/MrSriJay/jobfit-ai
          </a>
        </p>
        <p>
          <a className="text-link" href="mailto:jayanga.sl@gmail.com">
            jayanga.sl@gmail.com
          </a>
        </p>

        <div className="row">
          <button className="btn primary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
