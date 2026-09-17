import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const SessionContext = createContext(null);
const STORAGE_KEY = 'active_session';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function SessionProvider({ children }) {
  // Hydrate immediately from localStorage so a hard-refresh restores the session
  const [activeSession, setActiveSessionState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // If we hydrated a session from storage, verify it's still active on the server
  const [isHydrating, setIsHydrating] = useState(() => !!localStorage.getItem(STORAGE_KEY));

  const [students, setStudents] = useState([]);
  const [wsStatus, setWsStatus] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'error'
  const wsRef = useRef(null);

  // On mount: if we loaded a session from localStorage, confirm it's still active
  useEffect(() => {
    if (!activeSession) {
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    axios
      .get(`${API_BASE_URL}/api/sessions/${activeSession.id}`)
      .then((res) => {
        if (cancelled) return;
        if (!res.data.is_active) {
          // Session ended while teacher was away — clear it
          localStorage.removeItem(STORAGE_KEY);
          setActiveSessionState(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Can't verify (network error, 404) — clear to avoid stale state
          localStorage.removeItem(STORAGE_KEY);
          setActiveSessionState(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsHydrating(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only runs once on mount — not on every activeSession change

  // Sync activeSession → localStorage whenever it changes
  useEffect(() => {
    if (activeSession) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeSession));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeSession]);

  // Open/close WebSocket whenever session ID changes
  useEffect(() => {
    // Tear down any existing connection first
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    if (!activeSession) {
      setStudents([]);
      setWsStatus('idle');
      return;
    }

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/teacher/${activeSession.id}`);
    wsRef.current = ws;
    setWsStatus('connecting');

    ws.onopen = () => setWsStatus('connected');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStudents((prev) => {
          if (prev.some((s) => s.roll_no === data.roll_no)) return prev;
          return [data, ...prev];
        });
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };

    ws.onerror = () => setWsStatus('error');
    ws.onclose = () => {
      if (wsRef.current === ws) setWsStatus('error');
    };

    return () => {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [activeSession?.id]); // Only re-runs when the session ID actually changes

  const setActiveSession = useCallback((session) => {
    setStudents([]); // clear roster when session changes
    setActiveSessionState(session);
  }, []);

  const updateStudent = useCallback((id, patch) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeStudent = useCallback((id) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const createSession = useCallback(async (sessionData) => {
    const response = await axios.post(`${API_BASE_URL}/api/sessions`, sessionData);
    setStudents([]);
    setActiveSessionState(response.data);
    return response.data;
  }, []);

  return (
    <SessionContext.Provider
      value={{
        activeSession,
        setActiveSession,
        createSession,
        students,
        wsStatus,
        isHydrating,
        updateStudent,
        removeStudent,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
