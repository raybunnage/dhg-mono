import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ExpertProfiles from "@/pages/ExpertProfiles";

function App() {
  console.log('App component mounting');  // Debug log
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ExpertProfiles />} />
      </Routes>
    </Router>
  );
}

export default App;