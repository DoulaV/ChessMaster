import { HashRouter, Route, Routes } from 'react-router';
import { AnalysisPage } from './modules/analysis/AnalysisPage';
import { StudiesPage } from './modules/analysis/StudiesPage';
import { BlunderPage } from './modules/blunder/BlunderPage';
import { HomePage } from './modules/home/HomePage';
import { PlanningPage } from './modules/planning/PlanningPage';
import { PracticePage } from './modules/practice/PracticePage';
import { GameReviewPage } from './modules/review/GameReviewPage';
import { TacticsPage } from './modules/tactics/TacticsPage';
import { TrainPage } from './modules/train/TrainPage';
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
          <Route path="practice" element={<PracticePage />} />
          <Route path="train" element={<TrainPage />} />
          <Route path="game-review" element={<GameReviewPage />} />
          <Route path="tactics" element={<TacticsPage />} />
          <Route path="planning" element={<PlanningPage />} />
          <Route path="planning/:mode" element={<PlanningPage />} />
          <Route path="planning/:mode/:id" element={<PlanningPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="studies" element={<StudiesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
