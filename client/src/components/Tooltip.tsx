import type { ReactNode } from "react";

import { dismissTip, useTip } from "../tips";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tip">
      {children}
      <span className="tip-bubble" role="tooltip">
        {label}
      </span>
    </span>
  );
}

export function FlowTip({
  id,
  label,
  children,
  above = false,
  block = false,
}: {
  id: string;
  label: string;
  children: ReactNode;
  above?: boolean;
  block?: boolean;
}) {
  const show = useTip(id);
  if (!show) return children;
  return (
    <span className={`tip tip-open${above ? " tip-above" : ""}${block ? " tip-block" : ""}`}>
      {children}
      <span className="tip-bubble" role="tooltip" onClick={(event) => event.stopPropagation()}>
        {label}
        <button className="tip-gotit" type="button" onClick={() => dismissTip(id)}>
          Got it
        </button>
      </span>
    </span>
  );
}
