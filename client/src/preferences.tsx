import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { fill, messages, type Messages } from "./messages";

export type Locale = "en" | "si" | "ta";

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "si", label: "සිංහල" },
  { id: "ta", label: "தமிழ்" },
];

export interface Preferences {
  language: Locale;
  useOwnKey: boolean;
  apiKey: string;
  model: string;
}

const KEY = "jobfit-settings-v1";
const EVENT = "jobfit-settings";

const empty = (): Preferences => ({ language: "en", useOwnKey: false, apiKey: "", model: "" });

export function applyStoredLanguage(): void {
  document.documentElement.lang = loadPreferences().language;
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return empty();
    const record = data as Partial<Preferences>;
    const language = record.language === "si" || record.language === "ta" ? record.language : "en";
    return {
      language,
      useOwnKey: record.useOwnKey === true,
      apiKey: typeof record.apiKey === "string" ? record.apiKey : "",
      model: typeof record.model === "string" ? record.model : "",
    };
  } catch {
    return empty();
  }
}

export function savePreferences(next: Preferences): void {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function clearOwnKey(): void {
  const current = loadPreferences();
  savePreferences({ ...current, useOwnKey: false, apiKey: "", model: "" });
}

export function modelNameValid(value: string): boolean {
  return /^[A-Za-z0-9._:-]{2,80}$/.test(value.trim());
}

export function ownKeyValid(value: string): boolean {
  const key = value.trim();
  return key.length >= 20 && key.length <= 300 && !/\s/.test(key);
}

export function ownCredentialsReady(prefs: Preferences = loadPreferences()): boolean {
  return prefs.useOwnKey && ownKeyValid(prefs.apiKey) && modelNameValid(prefs.model);
}

export function requestOptions(): { language: Locale; useOwnKey: boolean; apiKey?: string; model?: string } {
  const prefs = loadPreferences();
  if (!prefs.useOwnKey) return { language: prefs.language, useOwnKey: false };
  return {
    language: prefs.language,
    useOwnKey: true,
    apiKey: prefs.apiKey.trim(),
    model: prefs.model.trim(),
  };
}

interface PreferencesContextValue {
  prefs: Preferences;
  m: Messages;
  update: (next: Preferences) => void;
  fill: typeof fill;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);

  useEffect(() => {
    const sync = () => setPrefs(loadPreferences());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = prefs.language;
  }, [prefs.language]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      prefs,
      m: messages[prefs.language],
      update: (next) => {
        savePreferences(next);
        setPrefs(next);
      },
      fill,
    }),
    [prefs],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("Preferences are unavailable.");
  return value;
}

export function bandLabel(classification: string, bands: Messages["bands"]): string {
  return bands[classification as keyof Messages["bands"]] ?? classification;
}
