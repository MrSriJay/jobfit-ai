import { useEffect, useState } from "react";

const TIPS_KEY = "jobfit-tips-v1";
const EVENT = "jobfit-tips";

export function dismissTips(): void {
  localStorage.setItem(TIPS_KEY, "1");
  window.dispatchEvent(new Event(EVENT));
}

export function useFirstVisit(): boolean {
  const [show, setShow] = useState(() => localStorage.getItem(TIPS_KEY) !== "1");
  useEffect(() => {
    const sync = () => setShow(localStorage.getItem(TIPS_KEY) !== "1");
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return show;
}
