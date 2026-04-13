import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NexusProvider } from './context/NexusContext';
import ProtectedRoute from './components/ProtectedRoute';
import OpsDashboard from './pages/OpsDashboard';
import FanApp from './pages/FanApp';
import DemoControls from './pages/DemoControls';
import MatchReport from './pages/MatchReport';
import './index.css';

function App() {
  return (
    <Router>
      <NexusProvider>
        <div className="nexus-root">
          <Routes>
            <Route path="/" element={<ProtectedRoute><OpsDashboard /></ProtectedRoute>} />
            <Route path="/fan" element={<FanApp />} />
            <Route path="/demo" element={<DemoControls />} />
            <Route path="/report" element={<MatchReport />} />
          </Routes>
        </div>
      </NexusProvider>
    </Router>
  );
}

export default App;
