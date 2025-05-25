import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Pages
import Viewer from './pages/Viewer';

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Viewer />} />
        </Routes>
      </div>
    </>
  );
}

export default App;