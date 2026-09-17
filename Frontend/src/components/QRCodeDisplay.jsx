import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { ScanFace, AlertTriangle } from 'lucide-react';

export default function QRCodeDisplay({ sessionId }) {
  const [totpData, setTotpData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/qr/${sessionId}`);

    ws.onmessage = (event) => {
      if (!isMounted) return;
      try {
        const data = JSON.parse(event.data);
        setTotpData(data);
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    ws.onerror = () => {
      if (isMounted) setError(true);
    };

    ws.onclose = () => {
      if (isMounted) setError(true);
    };

    return () => {
      isMounted = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      }
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-red-500">
        <AlertTriangle size={64} className="mb-4 opacity-80" />
        <h3 className="text-xl font-semibold">Connection Lost</h3>
        <p className="text-zinc-500 mt-2">Please restart the session.</p>
      </div>
    );
  }

  if (!totpData) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="mt-4 text-zinc-500 animate-pulse">Generating Secure Token...</p>
      </div>
    );
  }

  // Calculate circle dash offset for the 5-second countdown
  // 5 seconds = max value, 0 = min. Radius = 60, Circumference = 2 * PI * 60 ~= 377
  const circumference = 377;
  const strokeDashoffset = circumference - (totpData.expires_in / 5) * circumference;

  return (
    <div className="flex flex-col items-center p-8 w-full max-w-2xl">
      <div className="mb-10 text-center">
        <h2 className="text-4xl font-bold text-zinc-900 tracking-tight mb-3">Scan to Mark Attendance</h2>
        <p className="text-zinc-500 text-lg flex items-center justify-center gap-2">
          <ScanFace size={20} className="text-zinc-400" />
          Code refreshes automatically every 5 seconds
        </p>
      </div>

      <div className="relative flex items-center justify-center">
        {/* Progress Ring */}
        <svg className="absolute w-[400px] h-[400px] -rotate-90 transform" viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="80"
            r="70"
            className="stroke-zinc-100"
            strokeWidth="4"
            fill="transparent"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            className="stroke-zinc-900 transition-all duration-1000 ease-linear"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* QR Code Container */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_15px_rgba(0,0,0,0.06)] border border-zinc-100 z-10 relative">
          <QRCode
            value={JSON.stringify({ session_id: sessionId, token: totpData.token })}
            size={280}
            level="H"
            className="opacity-90"
          />
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-zinc-900 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm tracking-wider">
            {totpData.expires_in}s
          </div>
        </div>
      </div>

      <div className="mt-12 text-sm font-mono tracking-widest text-zinc-400">
        TOKEN: {totpData.token}
      </div>
    </div>
  );
}
