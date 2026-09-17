import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, History, Download, LogOut, User, FileSpreadsheet, FileText, FileJson } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useSession } from '../context/SessionContext';
import { exportToCSV, exportToExcel, exportToJSON } from '../utils/exportAttendance';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function TeacherLayout({ token, teacher, onLogout }) {
  const { activeSession, setActiveSession } = useSession();
  const [showEndMenu, setShowEndMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isLive = location.pathname === '/';

  const formatSessionDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const handleEndAndExport = async (format) => {
    if (!activeSession) return;
    try {
      await axios.post(`${API_BASE_URL}/api/sessions/${activeSession.id}/end`);

      const recordsRes = await axios.get(
        `${API_BASE_URL}/api/teacher/sessions/${activeSession.id}/records`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const records = recordsRes.data;

      if (format === 'excel') exportToExcel(activeSession, records);
      if (format === 'csv') exportToCSV(activeSession, records);
      if (format === 'json') exportToJSON(activeSession, records);

      setActiveSession(null);
      setShowEndMenu(false);
      navigate('/history');
    } catch (error) {
      console.error('Error ending session', error);
      alert('Failed to end session and export.');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FAFAFA] text-zinc-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col p-6 shadow-sm z-20">
        {/* Logo / Brand */}
        <div className="mb-10">
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
            Smart Attendance
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          <Link
            to="/"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isLive
                ? 'bg-zinc-100 text-zinc-900 font-medium'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <LayoutDashboard size={20} />
            <span>Live Session</span>
          </Link>
          <Link
            to="/history"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              location.pathname === '/history'
                ? 'bg-zinc-100 text-zinc-900 font-medium'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <History size={20} />
            <span>Class History</span>
          </Link>
        </nav>

        {/* User / Logout */}
        <div className="mt-auto border-t border-zinc-200 pt-6 space-y-4">
          <div className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-500">
            <div className="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center">
              <User size={16} className="text-zinc-400" />
            </div>
            <span className="font-medium truncate text-zinc-900">{teacher?.name}</span>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header (Session Info & Actions) */}
        <header className="flex justify-between items-center p-6 border-b border-zinc-200 bg-white/80 backdrop-blur-md z-10">
          <div>
            {activeSession && isLive ? (
              <p className="text-sm text-zinc-500">
                📅 <span className="text-zinc-900 font-medium">{formatSessionDate(activeSession.session_date)}</span> <span className="mx-2 text-zinc-300">|</span>
                ⏰ <span className="text-zinc-900 font-medium">{activeSession.start_time} - {activeSession.end_time}</span> <span className="mx-2 text-zinc-300">|</span>
                📍 <span className="text-zinc-900 font-medium">{activeSession.room}</span>
              </p>
            ) : (
              <h2 className="text-lg font-medium text-zinc-900">
                {isLive ? 'Dashboard' : 'Class History'}
              </h2>
            )}
          </div>

          {activeSession && isLive && (
            <div className="relative">
              <button
                onClick={() => setShowEndMenu(!showEndMenu)}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm"
              >
                <Download size={16} />
                End &amp; Export
              </button>

              {showEndMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-zinc-200 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] z-50 overflow-hidden">
                  <button
                    onClick={() => handleEndAndExport('excel')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <FileSpreadsheet size={16} className="text-zinc-500" /> End &amp; Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleEndAndExport('csv')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left border-t border-zinc-100"
                  >
                    <FileText size={16} className="text-zinc-500" /> End &amp; CSV (.csv)
                  </button>
                  <button
                    onClick={() => handleEndAndExport('json')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left border-t border-zinc-100"
                  >
                    <FileJson size={16} className="text-zinc-500" /> End &amp; JSON (.json)
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-[#FAFAFA] relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
