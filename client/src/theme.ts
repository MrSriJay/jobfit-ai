export type Theme = "dark" | "light";

const THEME_KEY = "jobfit-theme-v1";

export function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

export function applyStoredTheme(): void {
  document.documentElement.dataset.theme = readTheme();
}
