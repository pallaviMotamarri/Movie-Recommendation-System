import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import './App.css';
import Dashboard from './Dashboard/Dashboard.jsx';
import Search from './Search/Search.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/comedy" element={<Navigate to="/genre/comedy" replace />} />
        <Route path="/romance" element={<Navigate to="/genre/romance" replace />} />
        <Route path="/thriller" element={<Navigate to="/genre/thriller" replace />} />
        <Route path="/horror" element={<Navigate to="/genre/horror" replace />} />
        <Route path="/action" element={<Navigate to="/genre/action" replace />} />
        <Route path="/drama" element={<Navigate to="/genre/drama" replace />} />
        <Route path="/sci-fi" element={<Navigate to="/genre/sci-fi" replace />} />
        <Route path="/fantasy" element={<Navigate to="/genre/fantasy" replace />} />
        <Route path="/genre/:slug" element={<Dashboard />} />
        <Route path="/search" element={<Search />} />
      </Routes>
    </Router>
  );
}

export default App;