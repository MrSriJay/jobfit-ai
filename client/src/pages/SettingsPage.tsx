import { Eye, EyeOff, KeyRound, Languages } from "lucide-react";
import { useEffect, useState } from "react";

import { LOCALES, modelNameValid, ownKeyValid, usePreferences } from "../preferences";
import { useStore } from "../state";

const MODEL_SUGGESTIONS = [
  { id: "gpt-5.6-sol", note: "suggestionFlagship" },
  { id: "gpt-5.6-terra", note: "suggestionBalanced" },
  { id: "gpt-5.6-luna", note: "suggestionLower" },
  { id: "gpt-6.1-sol", note: "suggestionNewer" },
  { id: "gpt-6.1-terra", note: "suggestionFaster" },
] as const;

export function SettingsPage() {
  const { prefs, m, update, fill } = usePreferences();
  const { configured, allowBuiltin, builtinModel, notify } = useStore();
  const [useOwnKey, setUseOwnKey] = useState(prefs.useOwnKey || !allowBuiltin);
  const [apiKey, setApiKey] = useState(prefs.apiKey);
  const [model, setModel] = useState(prefs.model);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const ownOnly = !allowBuiltin;
  const showOwn = ownOnly || useOwnKey;

  useEffect(() => {
    setUseOwnKey(ownOnly || prefs.useOwnKey);
    setApiKey(prefs.apiKey);
    setModel(prefs.model);
  }, [ownOnly, prefs.useOwnKey, prefs.apiKey, prefs.model]);

  const chooseModel = (id: string) => {
    setUseOwnKey(true);
    setModel(id);
    setError("");
  };

  const save = () => {
    const savingOwn = ownOnly || useOwnKey;
    if (savingOwn && !ownKeyValid(apiKey)) {
      setError(m.settings.keyInvalid);
      return;
    }
    if (savingOwn && !modelNameValid(model)) {
      setError(m.settings.modelInvalid);
      return;
    }
    setError("");
    update({ ...prefs, useOwnKey: savingOwn, apiKey: apiKey.trim(), model: model.trim() });
    notify(m.settings.saved);
  };

  return (
    <section className="page settings-page">
      <h1>{m.settings.title}</h1>
      <p className="lede">{m.settings.lede}</p>

      <article className="card stack">
        <h2 className="section-label">
          <Languages size={18} aria-hidden="true" /> {m.settings.language}
        </h2>
        <p className="fine">{m.settings.languageHint}</p>
        <div className="choice-grid langs" role="radiogroup" aria-label={m.settings.language}>
          {LOCALES.map((item) => (
            <button
              key={item.id}
              className={prefs.language === item.id ? "choice-card active" : "choice-card"}
              type="button"
              role="radio"
              aria-checked={prefs.language === item.id}
              onClick={() => update({ ...prefs, language: item.id })}
            >
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>
        <p className="fine">{m.settings.pdfNote}</p>
      </article>

      <article className="card stack">
        <h2 className="section-label">
          <KeyRound size={18} aria-hidden="true" /> {m.settings.connection}
        </h2>
        {ownOnly ? null : (
          <div className="choice-grid" role="radiogroup" aria-label={m.settings.connection}>
            <button
              className={useOwnKey ? "choice-card" : "choice-card active"}
              type="button"
              role="radio"
              aria-checked={!useOwnKey}
              onClick={() => setUseOwnKey(false)}
            >
              <strong>{m.settings.builtin}</strong>
              <span>{m.settings.builtinHelp}</span>
            </button>
            <button
              className={useOwnKey ? "choice-card active" : "choice-card"}
              type="button"
              role="radio"
              aria-checked={useOwnKey}
              onClick={() => setUseOwnKey(true)}
            >
              <strong>{m.settings.own}</strong>
              <span>{m.settings.ownHelp}</span>
            </button>
          </div>
        )}

        {showOwn ? (
          <div className="stack">
            {ownOnly ? <p className="fine">{m.settings.ownHelp}</p> : null}
            <label className="field">
              <span>{m.settings.apiKey}</span>
              <span className="key-line">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <button className="btn ghost" type="button" onClick={() => setShowKey((value) => !value)}>
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showKey ? m.settings.hide : m.settings.show}
                </button>
              </span>
            </label>
            <label className="field">
              <span>{m.settings.model}</span>
              <input value={model} placeholder={m.settings.modelHint} spellCheck={false} onChange={(event) => setModel(event.target.value)} />
              <small>{m.settings.modelHint}</small>
            </label>
            <ModelSuggestions current={model} onChoose={chooseModel} />
          </div>
        ) : (
          <div className="stack">
            {builtinModel ? <p className="fine">{fill(m.settings.builtinModel, { model: builtinModel })}</p> : null}
            <ModelSuggestions current={builtinModel} onChoose={chooseModel} />
            {configured === "missing" ? (
              <div className="banner warn">
                <strong>{m.upload.keyTitle}</strong>
                <p>{m.settings.builtinMissing}</p>
              </div>
            ) : null}
          </div>
        )}

        {error ? (
          <div className="banner danger">
            <strong>{m.upload.couldNot}</strong>
            <p>{error}</p>
          </div>
        ) : null}
        <button className="btn primary" type="button" onClick={save}>
          {m.settings.save}
        </button>
      </article>
    </section>
  );
}

function ModelSuggestions({ current, onChoose }: { current: string; onChoose: (id: string) => void }) {
  const { m } = usePreferences();
  return (
    <div className="stack">
      <span className="fine">{m.settings.suggestions}</span>
      <div className="model-suggestions">
        {MODEL_SUGGESTIONS.map((item) => (
          <button
            key={item.id}
            className={current === item.id ? "active" : ""}
            type="button"
            onClick={() => onChoose(item.id)}
          >
            <strong>{item.id}</strong>
            <small>{m.settings[item.note]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
