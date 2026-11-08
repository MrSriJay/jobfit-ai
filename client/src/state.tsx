import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { apiStatus } from "./api";
import { emptySnapshot, loadSnapshot, MAX_HISTORY, saveSnapshot, type Snapshot } from "./storage";
import { resetTips } from "./tips";
import type { AnalysisRecord, CandidateProfile, JobPosting } from "./types";

interface Store {
  configured: "loading" | "ready" | "missing" | "offline";
  snapshot: Snapshot;
  profileNonce: number;
  notice: string;
  saveProfile: (profile: CandidateProfile, filename?: string) => void;
  setDraft: (job: JobPosting | null) => void;
  rememberAnalysis: (record: AnalysisRecord) => void;
  replaceAnalysis: (record: AnalysisRecord) => void;
  selectAnalysis: (id: string) => void;
  clearAll: () => void;
  clearCv: () => void;
  notify: (message: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => loadSnapshot());
  const [profileNonce, setProfileNonce] = useState(0);
  const [configured, setConfigured] = useState<"loading" | "ready" | "missing" | "offline">("loading");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    saveSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const status = await apiStatus();
          if (!cancelled) setConfigured(status.configured ? "ready" : "missing");
          return;
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 400));
        }
      }
      if (!cancelled) setConfigured("offline");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const store = useMemo<Store>(
    () => ({
      configured,
      snapshot,
      profileNonce,
      notice,
      saveProfile: (profile, filename) => {
        setSnapshot((current) => ({
          ...current,
          profile,
          cvFilename: filename ?? current.cvFilename,
        }));
        setProfileNonce((value) => value + 1);
      },
      setDraft: (job) => setSnapshot((current) => ({ ...current, draftJob: job })),
      rememberAnalysis: (record) =>
        setSnapshot((current) => ({
          ...current,
          history: [record, ...current.history.filter((item) => item.id !== record.id)].slice(0, MAX_HISTORY),
          currentAnalysisId: record.id,
        })),
      replaceAnalysis: (record) =>
        setSnapshot((current) => ({
          ...current,
          history: current.history.map((item) => (item.id === record.id ? record : item)),
          currentAnalysisId: record.id,
        })),
      selectAnalysis: (id) => setSnapshot((current) => ({ ...current, currentAnalysisId: id })),
      clearAll: () => {
        resetTips();
        setSnapshot(emptySnapshot());
        setProfileNonce((value) => value + 1);
        setNotice("Local data cleared");
      },
      clearCv: () => {
        setSnapshot((current) => ({ ...current, profile: null, cvFilename: "" }));
        setProfileNonce((value) => value + 1);
        setNotice("CV and profile removed");
      },
      notify: setNotice,
    }),
    [configured, snapshot, profileNonce, notice],
  );

  return (
    <StoreContext.Provider value={store}>
      {children}
      {notice ? <div className="toast">{notice}</div> : null}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Store is unavailable.");
  return store;
}
