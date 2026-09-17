import React, { useState, useEffect } from 'react';
import { X, User, Mail, Clock, Hash, Search, Download, FileSpreadsheet, FileText, FileJson, Trash2, CheckCircle, AlertTriangle, Info, Camera, UserCheck } from 'lucide-react';
import axios from 'axios';
import { exportToCSV, exportToExcel, exportToJSON } from '../utils/exportAttendance';
import SelfieModal from './SelfieModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function SessionDetailModal({ session, onClose }) {
  const sessionId = session.id;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedSelfie, setSelectedSelfie] = useState(null);

  useEffect(() => {
    fetchRecords();
  }, [sessionId]);

  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/teacher/sessions/${sessionId}/records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecords(response.data);
    } catch (err) {
      setError('Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:8000/api/attendance/${id}/verify`, null, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecords(prev => prev.map(r => r.id === id ? { ...r, is_flagged: false, verification_status: "VERIFIED" } : r));
    } catch (err) {
      console.error(err);
      alert("Failed to verify attendance.");
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm("Are you sure you want to revoke this attendance?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:8000/api/attendance/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to revoke attendance.");
    }
  };

  const filteredRecords = records.filter(record => 
    record.name.toLowerCase().includes(search.toLowerCase()) || 
    record.roll_no.toLowerCase().includes(search.toLowerCase()) ||
    record.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-6 border-b border-zinc-200 bg-zinc-50">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Attendance Roster</h2>
            <p className="text-zinc-500 text-sm mt-1">Session ID: {sessionId}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={records.length === 0}
                title={records.length === 0 ? "No attendance records to export" : "Export Attendance"}
                className="flex items-center gap-2 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-700 px-4 py-2 rounded-lg transition-colors border border-zinc-200 shadow-sm font-medium"
              >
                <Download size={16} /> Export
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <button 
                    onClick={() => { exportToExcel(session, records); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <FileSpreadsheet size={16} className="text-zinc-500" /> Excel (.xlsx)
                  </button>
                  <button 
                    onClick={() => { exportToCSV(session, records); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left border-t border-zinc-100"
                  >
                    <FileText size={16} className="text-zinc-500" /> CSV (.csv)
                  </button>
                  <button 
                    onClick={() => { exportToJSON(session, records); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left border-t border-zinc-100"
                  >
                    <FileJson size={16} className="text-zinc-500" /> JSON (.json)
                  </button>
                </div>
              )}
            </div>
            
            <button 
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 border-b border-zinc-200 bg-white">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              className="block w-full pl-10 pr-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              placeholder="Search by name, roll number, or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-[#FAFAFA]">
          {loading ? (
            <div className="text-center text-zinc-400 py-12">Loading records...</div>
          ) : error ? (
            <div className="text-center text-red-500 py-12">{error}</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center text-zinc-400 py-12">No records found.</div>
          ) : (
            <div className="overflow-x-auto bg-white border border-zinc-200 rounded-xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 text-sm bg-zinc-50">
                    <th className="py-3 font-medium px-4"><div className="flex items-center gap-2">Student</div></th>
                    <th className="py-3 font-medium px-4"><div className="flex items-center gap-2"><Hash size={14}/> Roll No</div></th>
                    <th className="py-3 font-medium px-4"><div className="flex items-center gap-2"><Clock size={14}/> Timestamp</div></th>
                    <th className="py-3 font-medium px-4"><div className="flex items-center gap-2"><AlertTriangle size={14}/> Status & Telemetry</div></th>
                    <th className="py-3 font-medium px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredRecords.map((record, idx) => (
                    <tr key={idx} className={`hover:bg-zinc-50 transition-colors ${record.is_flagged ? 'bg-red-50/50 hover:bg-red-50' : ''}`}>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {record.has_selfie ? (
                            <button 
                              onClick={() => setSelectedSelfie(record)}
                              className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center bg-zinc-50 text-zinc-600 flex-shrink-0 hover:bg-zinc-100 transition-colors focus:outline-none"
                              title="View Selfie"
                            >
                              <Camera size={14} />
                            </button>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 flex-shrink-0">
                              <UserCheck size={14} />
                            </div>
                          )}
                          <div>
                            <div className="text-zinc-900 font-medium">{record.name}</div>
                            <div className="text-zinc-500 text-xs">{record.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-zinc-600 font-mono text-sm">{record.roll_no}</td>
                      <td className="py-4 px-4 text-zinc-500 text-sm">{new Date(record.timestamp).toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {record.platform === 'ios_web' ? (
                            <span className="text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200 px-1.5 py-0.5 rounded">iOS</span>
                          ) : (
                            <span className="text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200 px-1.5 py-0.5 rounded">Android</span>
                          )}

                          {!record.is_flagged ? (
                            record.verification_status === 'VERIFIED' ? (
                              <span className="flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200 font-medium">
                                <CheckCircle size={12} /> Verified
                              </span>
                            ) : record.has_selfie ? (
                              <span className="flex items-center gap-1 text-[11px] bg-zinc-100 text-zinc-700 px-2 py-1 rounded-full border border-zinc-200 font-medium">
                                <Camera size={12} /> Photo Verified
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full border border-zinc-200 font-medium">
                                <CheckCircle size={12} /> Clean
                              </span>
                            )
                          ) : (
                            <div className="group relative flex items-center">
                              <span className="flex items-center gap-1 text-[11px] bg-red-50 text-red-600 px-2 py-1 rounded-full border border-red-200 font-medium cursor-help">
                                <AlertTriangle size={12} /> Flagged
                              </span>
                              {record.flag_reasons && record.flag_reasons.length > 0 && (
                                <div className="absolute left-0 bottom-full mb-2 w-64 bg-white border border-zinc-200 p-3 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                  <p className="text-xs font-semibold text-zinc-900 mb-2 flex items-center gap-1">
                                    <Info size={12} className="text-red-500" /> Detected Anomalies:
                                  </p>
                                  <ul className="space-y-1.5">
                                    {record.flag_reasons.map((reason, i) => (
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
                      </td>
                      <td className="py-4 px-4 text-right">
                        {record.is_flagged && (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleVerify(record.id)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-md transition-colors"
                              title="Mark Verified"
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button 
                              onClick={() => handleRevoke(record.id)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md transition-colors"
                              title="Revoke Attendance"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
      </div>

      <SelfieModal selfie={selectedSelfie} onClose={() => setSelectedSelfie(null)} />
    </div>
  );
}
