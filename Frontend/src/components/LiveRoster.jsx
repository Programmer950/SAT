import React, { useState } from 'react';
import { Users, UserCheck, Trash2, CheckCircle, AlertTriangle, Info, Camera } from 'lucide-react';
import axios from 'axios';
import SelfieModal from './SelfieModal';
import { useSession } from '../context/SessionContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function LiveRoster() {
  const { students, wsStatus, updateStudent, removeStudent } = useSession();
  const [selectedSelfie, setSelectedSelfie] = useState(null);

  const handleVerify = async (id) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/attendance/${id}/verify`);
      updateStudent(id, { is_flagged: false, verification_status: 'VERIFIED' });
    } catch (err) {
      console.error(err);
      alert('Failed to verify attendance.');
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this attendance?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/attendance/${id}`);
      removeStudent(id);
    } catch (err) {
      console.error(err);
      alert('Failed to revoke attendance.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-200/50 rounded-lg">
            <Users size={20} className="text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900">Live Roster</h3>
          {wsStatus === 'error' && (
            <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
              WS Disconnected
            </span>
          )}
          {wsStatus === 'connecting' && (
            <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
              Connecting...
            </span>
          )}
        </div>
        <div className="bg-zinc-900 px-3 py-1 rounded-full text-sm font-bold text-white shadow-sm">
          {students.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {students.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400">
            <UserCheck size={48} className="mb-3 opacity-50" />
            <p className="text-sm">Waiting for check-ins...</p>
          </div>
        ) : (
          students.map((student, idx) => (
            <div
              key={`${student.roll_no}-${idx}`}
              className={`border p-4 rounded-xl flex items-center justify-between animate-in slide-in-from-right-4 fade-in duration-300 shadow-sm transition-all ${student.is_flagged
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-md'
                }`}
            >
              <div className="flex items-center gap-3">
                {student.has_selfie ? (
                  <button
                    onClick={() => setSelectedSelfie(student)}
                    className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center bg-zinc-50 text-zinc-600 flex-shrink-0 hover:bg-zinc-100 transition-colors focus:outline-none"
                    title="View Selfie"
                  >
                    <Camera size={18} />
                  </button>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 flex-shrink-0">
                    <UserCheck size={18} />
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-zinc-900">{student.name}</p>
                    {student.platform === 'ios_web' ? (
                      <span className="text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200 px-1.5 py-0.5 rounded">iOS</span>
                    ) : (
                      <span className="text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200 px-1.5 py-0.5 rounded">Android</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-zinc-500 font-mono">{student.roll_no}</p>
                    <span className="text-[10px] text-zinc-400 px-1">
                      {new Date(student.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {!student.is_flagged ? (
                    student.verification_status === 'VERIFIED' ? (
                      <span className="flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200 font-medium">
                        <CheckCircle size={12} /> Verified
                      </span>
                    ) : student.has_selfie ? (
                      <span className="flex items-center gap-1 text-[11px] bg-zinc-100 text-zinc-700 px-2 py-1 rounded-full border border-zinc-200 font-medium">
                        <Camera size={12} /> Photo Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full border border-zinc-200 font-medium">
                        <CheckCircle size={12} /> Present
                      </span>
                    )
                  ) : (
                    <div className="group relative flex items-center">
                      <span className="flex items-center gap-1 text-[11px] bg-red-50 text-red-600 px-2 py-1 rounded-full border border-red-200 font-medium cursor-help">
                        <AlertTriangle size={12} /> Flagged
                      </span>
                      {student.flag_reasons && student.flag_reasons.length > 0 && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-zinc-200 p-3 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                          <p className="text-xs font-semibold text-zinc-900 mb-2 flex items-center gap-1">
                            <Info size={12} className="text-red-500" /> Detected Anomalies:
                          </p>
                          <ul className="space-y-1.5">
                            {student.flag_reasons.map((reason, i) => (
                              <li key={i} className="text-[11px] text-zinc-600 leading-tight flex items-start gap-1.5">
                                <span className="mt-0.5 text-[8px] text-red-400">•</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {student.is_flagged && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify(student.id)}
                      className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-md transition-colors"
                      title="Mark Verified"
                    >
                      <CheckCircle size={14} />
                    </button>
                    <button
                      onClick={() => handleRevoke(student.id)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md transition-colors"
                      title="Revoke Attendance"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <SelfieModal selfie={selectedSelfie} onClose={() => setSelectedSelfie(null)} />
    </div>
  );
}
