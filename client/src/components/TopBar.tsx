import { History, Moon, Plus, Settings, Sun, Upload, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import { useStore } from "../state";
import { applyTheme, readTheme, type Theme } from "../theme";
import { Logo } from "./Logo";
import { SettingsMenu } from "./SettingsMenu";
import { FlowTip } from "./Tooltip";

const links = [{ to: "/upload", label: "Profile", icon: UserRound }];

export function TopBar() {
  const { snapshot } = useStore();
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
        <Logo size={42} />
        <div>
          <strong className="wordmark"><span className="mark-job">Job</span><span className="mark-fit">Fit</span></strong>
          <small>CV to match</small>
        </div>
      </Link>
      <nav className="nav" aria-label="Main">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon size={16} aria-hidden="true" />
              {link.label}
            </NavLink>
          );
        })}
        {snapshot.profile ? (
          <NavLink to="/analysis" className={({ isActive }) => (isActive ? "active" : "")}>
            <History size={16} aria-hidden="true" />
            Analysis
          </NavLink>
        ) : null}
      </nav>
      <div className="settings-slot">
        {snapshot.profile ? (
          <Link className="btn primary upload-cta" to="/job" state={{ fresh: true }}>
            <Plus size={16} /> New analysis
          </Link>
        ) : (
          <Link className="btn primary upload-cta" to="/upload">
            <Upload size={16} /> Upload CV
          </Link>
        )}
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
            <FlowTip id="settings" label="Settings keeps saved matches. Clear local data removes them from this browser only.">
              {settingsButton}
            </FlowTip>
          }
        />
      </div>
    </header>
  );
}
