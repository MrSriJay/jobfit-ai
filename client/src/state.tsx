import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { apiStatus } from "./api";
import { emptySnapshot, loadSnapshot, MAX_HISTORY, saveSnapshot, type Snapshot } from "./storage";
import { clearOwnKey } from "./preferences";
import { resetTips } from "./tips";
import type { AnalysisRecord, CandidateProfile, JobPosting } from "./types";

interface Store {
  configured: "loading" | "ready" | "missing" | "offline";
  allowBuiltin: boolean;
  builtinModel: string;
  snapshot: Snapshot;
  profileNonce: number;
  notice: string;
  saveProfile: (profile: CandidateProfile, filename?: string) => void;
  setDraft: (job: JobPosting | null) => void;
  rememberAnalysis: (record: AnalysisRecord) => void;
  replaceAnalysis: (record: AnalysisRecord) => void;
  selectAnalysis: (id: string) => void;
  clearAll: (message?: string) => void;
  clearCv: (message?: string) => void;
  notify: (message: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => loadSnapshot());
  const [profileNonce, setProfileNonce] = useState(0);
  const [configured, setConfigured] = useState<"loading" | "ready" | "missing" | "offline">("loading");
  const [allowBuiltin, setAllowBuiltin] = useState(true);
  const [builtinModel, setBuiltinModel] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    saveSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const load = async () => {
      try {
        const status = await apiStatus();
        if (cancelled) return;
        setConfigured(status.configured ? "ready" : "missing");
        setAllowBuiltin(status.allowBuiltin);
        setBuiltinModel(status.model);
      } catch {
        if (cancelled) return;
        setConfigured("offline");
        timer = window.setTimeout(() => void load(), 3000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
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
      allowBuiltin,
      builtinModel,
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
      clearAll: (message = "Local data cleared") => {
        resetTips();
        clearOwnKey();
        window.dispatchEvent(new Event("jobfit-key-warn"));
        setSnapshot(emptySnapshot());
        setProfileNonce((value) => value + 1);
        setNotice(message);
      },
      clearCv: (message = "CV and profile removed") => {
        setSnapshot((current) => ({ ...current, profile: null, cvFilename: "" }));
        setProfileNonce((value) => value + 1);
        setNotice(message);
      },
      notify: setNotice,
    }),
    [configured, allowBuiltin, builtinModel, snapshot, profileNonce, notice],
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
