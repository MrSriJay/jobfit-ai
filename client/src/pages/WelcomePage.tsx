import { ArrowRight } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { Logo } from "../components/Logo";
import { useStore } from "../state";

const steps = [
  { n: "1", title: "Upload a CV", text: "PDF or DOCX, read once and saved in this browser." },
  { n: "2", title: "Paste a job", text: "The same profile is compared with each new role." },
  { n: "3", title: "Read the fit", text: "A scored report, the gaps, and a draft email." },
];

export function WelcomePage() {
  const { snapshot } = useStore();
  if (snapshot.profile && snapshot.cvFilename) {
    return <Navigate to="/upload" replace />;
  }

  return (
    <section className="welcome">
      <Logo size={84} />
      <p className="eyebrow wordmark"><span className="mark-job">Job</span><span className="mark-fit">Fit</span></p>
      <h1>See how well a CV fits the role.</h1>
      <p className="lede welcome-copy">
        JobFit reads one resume, compares it with a job description, and explains the match. You get a score, the missing evidence, and an application email you can edit.
      </p>
      <ol className="welcome-steps">
        {steps.map((step) => (
          <li key={step.n}>
            <span>{step.n}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link className="btn primary welcome-start" to="/upload">
        Start here <ArrowRight size={18} />
      </Link>
    </section>
  );
}
