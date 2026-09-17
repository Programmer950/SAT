import React, { useState, useEffect } from 'react';
import { X, MapPin, Smartphone, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function SelfieModal({ selfie, onClose }) {
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selfie && selfie.has_selfie && !selfie.selfie_url) {
      setIsLoading(true);
      axios.get(`${API_BASE_URL}/api/attendance/${selfie.id}/selfie`)
        .then(res => {
          setLoadedUrl(res.data.selfie_url);
        })
        .catch(err => console.error("Failed to load selfie:", err))
        .finally(() => setIsLoading(false));
    } else if (selfie && selfie.selfie_url) {
      setLoadedUrl(selfie.selfie_url);
    }
  }, [selfie]);

  if (!selfie) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white border border-zinc-200 rounded-2xl overflow-hidden max-w-sm w-full shadow-lg animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-zinc-200 bg-zinc-50">
          <h3 className="font-semibold text-zinc-900 truncate pr-4">{selfie.name} <span className="text-zinc-500 font-normal">({selfie.roll_no})</span></h3>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="bg-zinc-100 flex items-center justify-center aspect-[3/4]">
          {isLoading ? (
            <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-900 rounded-full animate-spin"></div>
          ) : (
            <img 
              src={loadedUrl || selfie.selfie_url} 
              alt={`Selfie of ${selfie.name}`} 
              className="w-full h-full object-contain"
            />
          )}
        </div>
        
        <div className="p-4 space-y-3 bg-white">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Smartphone size={16} className="text-zinc-400" />
            <span>Platform: <span className="font-medium text-zinc-900 capitalize">{selfie.platform?.replace('_', ' ')}</span></span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <MapPin size={16} className="text-zinc-400" />
            <span>Marked At: <span className="font-medium text-zinc-900">{new Date(selfie.timestamp).toLocaleTimeString()}</span></span>
          </div>
          
          {selfie.flag_reasons && selfie.flag_reasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-100">
              <div className="flex items-center gap-2 text-sm font-medium text-red-600 mb-2">
                <AlertTriangle size={16} /> Anomaly Flags
              </div>
              <ul className="space-y-1">
                {selfie.flag_reasons.map((reason, idx) => (
                  <li key={idx} className="text-xs text-red-500/90 pl-6 relative">
                    <span className="absolute left-2 top-1.5 w-1 h-1 bg-red-500 rounded-full"></span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
