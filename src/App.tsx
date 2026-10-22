import { HashRouter, Route, Routes } from 'react-router';
import { AnalysisPage } from './modules/analysis/AnalysisPage';
import { StudiesPage } from './modules/analysis/StudiesPage';
import { HomePage } from './modules/home/HomePage';
import { SettingsPage } from './modules/settings/SettingsPage';
import { Layout } from './ui/Layout';

// Hash URLs (…/#/analysis) so every page works on GitHub Pages without server setup.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="studies" element={<StudiesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
