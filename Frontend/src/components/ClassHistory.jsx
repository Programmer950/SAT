import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Download, Eye } from 'lucide-react';
import axios from 'axios';
import SessionDetailModal from './SessionDetailModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ClassHistory() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/teacher/sessions`);
      setSessions(response.data);
    } catch (err) {
      setError('Failed to fetch class history');
    } finally {
      setLoading(false);
    }
  };

  const formatSessionDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">Loading history...</div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-1 overflow-auto p-6 bg-[#FAFAFA]">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Class History</h2>
          <p className="text-zinc-500">View past sessions and export attendance records.</p>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <Calendar className="mx-auto text-zinc-300 mb-4" size={48} />
            <p className="text-zinc-500 text-lg">No classes found.</p>
            <p className="text-zinc-400 text-sm mt-2">Classes you create will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">{session.course_code}</h3>
                    <p className="text-zinc-500 text-sm flex items-center gap-1 mt-1">
                      <MapPin size={14} /> {session.room}
                    </p>
                  </div>
                  <div className="bg-zinc-100 text-zinc-700 px-3 py-1 rounded-full text-xs font-medium border border-zinc-200">
                    {session.attendees_count} Present
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-zinc-600 text-sm">
                    <Calendar size={16} className="text-zinc-400" />
                    <span>{formatSessionDate(session.session_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-600 text-sm">
                    <Clock size={16} className="text-zinc-400" />
                    <span>{session.start_time} - {session.end_time}</span>
                  </div>
                </div>
                
                <div className="mt-auto pt-4 border-t border-zinc-100 flex gap-3">
                  <button 
                    onClick={() => setSelectedSession(session)}
                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <Eye size={16} /> Roster
                  </button>
                  <button 
                    onClick={() => setSelectedSession(session)}
                    className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 py-2 rounded-lg text-sm font-medium transition-colors border border-zinc-200 shadow-sm"
                  >
                    <Download size={16} /> Export
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {selectedSession && (
        <SessionDetailModal 
          session={selectedSession} 
          onClose={() => setSelectedSession(null)} 
        />
      )}
    </div>
  );
}
