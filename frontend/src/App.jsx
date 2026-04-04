import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
        <Route path="/genre/:slug" element={<Dashboard />} />
        <Route path="/search" element={<Search />} />
      </Routes>
    </Router>
  );
}

export default App;