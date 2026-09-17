import React, { useState, useEffect } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import axios from 'axios';

import AuthView from './components/AuthView';
import ClassHistory from './components/ClassHistory';
import MobileScanner from './pages/MobileScanner';
import TeacherLayout from './pages/TeacherLayout';
import LiveView from './pages/LiveView';
import { SessionProvider, useSession } from './context/SessionContext';

// Global ngrok bypass header
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

/**
 * Auth guard + axios interceptor.
 * Rendered as a <Route element> so React Router injects the matched child
 * via <Outlet /> — no nested <Routes> here, no cloning needed.
 */
function TeacherAuthGuard() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [teacher, setTeacher] = useState(JSON.parse(localStorage.getItem('teacher')) || null);
  const { setActiveSession, isHydrating } = useSession();

  // Axios auth interceptor
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const t = localStorage.getItem('token');
        if (t) config.headers.Authorization = `Bearer ${t}`;
        return config;
      },
      (error) => Promise.reject(error)
    );
    return () => axios.interceptors.request.eject(interceptor);
  }, [token]);

  const handleAuthSuccess = (newToken, newTeacher) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('teacher', JSON.stringify(newTeacher));
    setToken(newToken);
    setTeacher(newTeacher);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('teacher');
    setToken(null);
    setTeacher(null);
    setActiveSession(null);
  };

  // Not authenticated → show login
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <AuthView onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  // Context is verifying the stored session against the server
  if (isHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Authenticated — render the TeacherLayout shell with the matched child route
  return <TeacherLayout token={token} teacher={teacher} onLogout={handleLogout} />;
}

/**
 * LiveView no longer needs onCreateSession as a prop —
 * it reads createSession directly from SessionContext.
 */

function App() {
  return (
    <Routes>
      {/* Mobile student scanner — isolated, no auth, no teacher layout */}
      <Route path="/scan" element={<MobileScanner />} />

      {/*
        Teacher area — SessionProvider wraps everything so the WebSocket
        and activeSession survive navigation between / and /history.
        TeacherAuthGuard is the layout element; TeacherLayout renders <Outlet />.
      */}
      <Route
        element={
          <SessionProvider>
            <TeacherAuthGuard />
          </SessionProvider>
        }
      >
        <Route index element={<LiveView />} />
        <Route path="history" element={<ClassHistory />} />
      </Route>
    </Routes>
  );
}

export default App;
