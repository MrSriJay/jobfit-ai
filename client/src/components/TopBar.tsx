import { Briefcase, Moon, Settings, Sparkles, Sun, Upload } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import { applyTheme, readTheme, type Theme } from "../theme";
import { useFirstVisit } from "../tips";
import { Logo } from "./Logo";
import { SettingsMenu } from "./SettingsMenu";
import { Tooltip } from "./Tooltip";

const links = [
  { to: "/upload", label: "Upload CV", icon: Upload, end: false },
  { to: "/job", label: "Job description", icon: Briefcase, end: false },
  { to: "/analysis", label: "Match analysis", icon: Sparkles, end: false },
];

export function TopBar() {
  const firstVisit = useFirstVisit();
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  const light = theme === "light";
  const settingsButton = (
    <button className="icon-button" type="button" aria-label="Settings">
      <Settings size={18} />
    </button>
  );

  return (
    <header className="topbar">
      <Link className="brand" to="/" aria-label="JobFit home">
        <Logo size={46} />
        <div>
          <strong className="wordmark"><span className="mark-job">Job</span><span className="mark-fit">Fit</span></strong>
          <small>CV to match</small>
        </div>
      </Link>
      <nav className="nav" aria-label="Steps">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon size={16} aria-hidden="true" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="settings-slot">
        <button
          className="icon-button"
          type="button"
          aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
          aria-pressed={light}
          onClick={() => {
            const next: Theme = light ? "dark" : "light";
            applyTheme(next);
            setTheme(next);
          }}
        >
          {light ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <SettingsMenu
          trigger={
            firstVisit ? (
              <Tooltip label="First visit: settings keeps saved matches. Clear local data removes them from this browser only.">
                {settingsButton}
              </Tooltip>
            ) : (
              settingsButton
            )
          }
        />
      </div>
    </header>
  );
}
