import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePreferences } from "../preferences";

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
  const { m } = usePreferences();
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
        <p className="eyebrow">{m.about.kicker}</p>
        <h2 id="about-title">{m.about.title}</h2>
        <p>{m.about.intro}</p>

        <h3>{m.about.story}</h3>
        <p>{m.about.storyLead}</p>
        <p>{m.about.storyBody}</p>

        <h3>{m.about.security}</h3>
        <p>{m.about.securityBody}</p>
        <p>{m.about.securityApi}</p>

        <h3>{m.about.technical}</h3>
        <p>{m.about.technicalBody}</p>

        <h3>{m.about.stack}</h3>
        <ul>
          {m.about.stackItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h3>{m.about.model}</h3>
        <p>{m.about.modelBody}</p>

        <h3>{m.about.developer}</h3>
        <p>{m.about.developerBody}</p>
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
            {m.about.close}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
