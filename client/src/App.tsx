import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AboutProvider, useOpenAbout } from "./components/AboutDialog";
import { TopBar } from "./components/TopBar";
import { JobPage } from "./pages/JobPage";
import { ResultsPage } from "./pages/ResultsPage";
import { UploadPage } from "./pages/UploadPage";
import { WelcomePage } from "./pages/WelcomePage";
import { StoreProvider } from "./state";

export function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <AboutProvider>
          <div className="shell">
            <TopBar />
            <main>
              <Routes>
                <Route path="/" element={<WelcomePage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/job" element={<JobPage />} />
                <Route path="/analysis" element={<ResultsPage />} />
              </Routes>
            </main>
            <SiteFoot />
          </div>
        </AboutProvider>
      </BrowserRouter>
    </StoreProvider>
  );
}

function SiteFoot() {
  const openAbout = useOpenAbout();
  return (
    <footer className="site-foot">
      Your information stays in this browser, which keeps it out of any public database.{" "}
      <button className="foot-link" type="button" onClick={openAbout}>
        About
      </button>
    </footer>
  );
}
