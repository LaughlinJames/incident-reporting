import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { IncidentListPage } from './pages/IncidentListPage.jsx';
import { IncidentDetailPage } from './pages/IncidentDetailPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { IncidentIntelligencePage } from './pages/IncidentIntelligencePage.jsx';

function Nav() {
  return (
    <nav className="nav">
      <NavLink end to="/" className={({ isActive }) => (isActive ? 'active' : undefined)}>
        Incidents
      </NavLink>
      <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : undefined)}>
        Dashboard
      </NavLink>
      <NavLink to="/intelligence" className={({ isActive }) => (isActive ? 'active' : undefined)}>
        Incident Intelligence
      </NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Incident Intelligence</h1>
        <Nav />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<IncidentListPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/intelligence" element={<IncidentIntelligencePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
