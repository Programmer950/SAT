import React, { useState } from 'react';
import { BookOpen, MapPin, Clock, Play, Calendar } from 'lucide-react';

export default function SetupView({ onCreateSession }) {
  const [formData, setFormData] = useState({
    course_code: '',
    room: '',
    duration_minutes: 60,
    session_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateSession(formData);
  };

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-zinc-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-y-auto max-h-full">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 mb-2 tracking-tight">New Session</h2>
        <p className="text-zinc-500 text-sm">Initialize a secure attendance tracking instance.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Course Code</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <BookOpen size={18} />
            </div>
            <input 
              type="text" 
              required
              className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              placeholder="e.g. CS101"
              value={formData.course_code}
              onChange={e => setFormData({...formData, course_code: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Room / Location</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <MapPin size={18} />
            </div>
            <input 
              type="text" 
              required
              className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              placeholder="e.g. Room 402"
              value={formData.room}
              onChange={e => setFormData({...formData, room: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Session Date</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Calendar size={18} />
            </div>
            <input 
              type="date"
              required
              className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              value={formData.session_date}
              onChange={e => setFormData({...formData, session_date: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Start Time</label>
            <input 
              type="time" 
              required
              className="block w-full px-3 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              value={formData.start_time}
              onChange={e => setFormData({...formData, start_time: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">End Time</label>
            <input 
              type="time" 
              required
              className="block w-full px-3 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              value={formData.end_time}
              onChange={e => setFormData({...formData, end_time: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Duration (Minutes)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Clock size={18} />
            </div>
            <input 
              type="number" 
              required
              min="1"
              className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              value={formData.duration_minutes}
              onChange={e => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <button 
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white py-3 px-4 rounded-lg font-medium shadow-sm transition-all active:scale-[0.98] mt-4"
        >
          <Play size={18} />
          Start Session
        </button>
      </form>
    </div>
  );
}
