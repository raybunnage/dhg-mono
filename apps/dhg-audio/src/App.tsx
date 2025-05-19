import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components';
import { HomePage, AudioDetailPage, AboutPage } from '@/pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="audio/:id" element={<AudioDetailPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;