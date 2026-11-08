import { useEffect, useState } from "react";

const TIPS_KEY = "jobfit-tips-v1";
const EVENT = "jobfit-tips";

function readDismissed(): Set<string> {
  const raw = localStorage.getItem(TIPS_KEY);
  if (raw === "1") return new Set(["all"]);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((item) => typeof item === "string"));
  } catch {
    return new Set();
  }
  return new Set();
}

function writeDismissed(ids: Set<string>): void {
  localStorage.setItem(TIPS_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new Event(EVENT));
}

export function resetTips(): void {
  localStorage.removeItem(TIPS_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function dismissTip(id: string): void {
  const ids = readDismissed();
  if (ids.has("all") || ids.has(id)) return;
  ids.add(id);
  writeDismissed(ids);
}

export function useTip(id: string): boolean {
  const [dismissed, setDismissed] = useState(readDismissed);
  useEffect(() => {
    const sync = () => setDismissed(readDismissed());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return !dismissed.has("all") && !dismissed.has(id);
}
