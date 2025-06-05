import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import GmailPage from './pages/GmailPage';
import ViewerPage from './pages/ViewerPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<GmailPage />} />
        <Route path="gmail" element={<GmailPage />} />
        <Route path="viewer" element={<ViewerPage />} />
      </Route>
    </Routes>
  );
}

export default App;