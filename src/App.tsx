import { HashRouter, Route, Routes } from 'react-router';
import { AnalysisPage } from './modules/analysis/AnalysisPage';
import { StudiesPage } from './modules/analysis/StudiesPage';
import { BlunderPage } from './modules/blunder/BlunderPage';
import { HomePage } from './modules/home/HomePage';
import { OpeningPage } from './modules/openings/OpeningPage';
import { OpeningsPage } from './modules/openings/OpeningsPage';
import { RecognizePage } from './modules/openings/RecognizePage';
import { ReviewPage } from './modules/openings/ReviewPage';
import { SettingsPage } from './modules/settings/SettingsPage';
import { Layout } from './ui/Layout';

// Hash URLs (…/#/analysis) so every page works on GitHub Pages without server setup.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="openings" element={<OpeningsPage />} />
          <Route path="openings/review" element={<ReviewPage />} />
          <Route path="openings/recognize" element={<RecognizePage />} />
          <Route path="openings/:id" element={<OpeningPage />} />
          <Route path="blunder-check" element={<BlunderPage />} />
          <Route path="blunder-check/:mode" element={<BlunderPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="studies" element={<StudiesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
