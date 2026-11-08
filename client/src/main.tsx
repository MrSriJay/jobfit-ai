import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { applyStoredLanguage } from "./preferences";
import { applyStoredTheme } from "./theme";
import "./styles.css";

applyStoredTheme();
applyStoredLanguage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
