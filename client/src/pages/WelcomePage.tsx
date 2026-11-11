import { ArrowRight } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { Logo } from "../components/Logo";
import { FlowTip } from "../components/Tooltip";
import { dismissTip } from "../tips";
import { usePreferences } from "../preferences";
import { useStore } from "../state";

export function WelcomePage() {
  const { snapshot } = useStore();
  const { m } = usePreferences();
  if (snapshot.profile) {
    return <Navigate to="/analysis" replace />;
  }

  return (
    <section className="welcome">
      <div className="welcome-inner">
        <Logo size={84} />
        <p className="eyebrow wordmark"><span className="mark-job">Job</span><span className="mark-fit">Fit</span></p>
        <h1>{m.welcome.title}</h1>
        <p className="lede welcome-copy">{m.welcome.lede}</p>
        <ol className="welcome-steps">
          {m.welcome.steps.map((step, index) => (
            <li key={step.title}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <FlowTip id="start" label={m.welcome.tip}>
          <Link className="btn primary welcome-start" to="/upload" onClick={() => dismissTip("start")}>
            {m.welcome.start} <ArrowRight size={18} />
          </Link>
        </FlowTip>
      </div>
    </section>
  );
}
