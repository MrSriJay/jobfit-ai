import { BrowserRouter, Route, Routes } from "react-router-dom";

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
        </div>
      </BrowserRouter>
    </StoreProvider>
  );
}
