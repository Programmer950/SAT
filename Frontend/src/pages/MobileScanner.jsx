import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import fpPromise from '@fingerprintjs/fingerprintjs';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, CheckCircle2, XCircle, Camera, ShieldAlert,
  Loader2, UserPen, ArrowRight, Smartphone
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function MobileScanner() {
  const [isAndroid, setIsAndroid] = useState(false);
  const [profile, setProfile] = useState(null);
  const [deviceUuid, setDeviceUuid] = useState(null);
  const [fingerprintId, setFingerprintId] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', roll_no: '', email: '' });

  const [scanStatus, setScanStatus] = useState('IDLE'); // IDLE, SCANNING, SUCCESS, SELFIE_REQUIRED, ERROR
  const [statusMessage, setStatusMessage] = useState('');
  const [flagReasons, setFlagReasons] = useState([]);
  const [responseData, setResponseData] = useState(null);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const [isTestBypass, setIsTestBypass] = useState(
    searchParams.get('bypass') === 'true' || import.meta.env.DEV
  );

  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fingerprintRef = useRef(null);

  useEffect(() => {
    // 1. Android Detection
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(userAgent)) {
      setIsAndroid(true);
    }

    // 2. Load Profile
    const storedProfile = localStorage.getItem('student_profile');
    if (storedProfile) {
      setProfile(JSON.parse(storedProfile));
      setScanStatus('SCANNING');
    } else {
      setShowRegistration(true);
    }

    // 3. Load or Generate UUID
    let uuid = localStorage.getItem('device_uuid');
    if (!uuid) {
      uuid = crypto.randomUUID ? crypto.randomUUID() : 'uuid-' + Date.now();
      localStorage.setItem('device_uuid', uuid);
    }
    setDeviceUuid(uuid);

    // 4. Initialize Fingerprint
    fpPromise.load().then(fp => fp.get()).then(result => {
      setFingerprintId(result.visitorId);
      fingerprintRef.current = result.visitorId;
    });
  }, []);



  // QR Scanner lifecycle
  useEffect(() => {
    if (!profile || scanStatus !== 'SCANNING') return;

    const readerElement = document.getElementById("reader");
    if (!readerElement) return;

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        try {
          await html5QrCode.stop();
          html5QrCode.clear();
          scannerRef.current = null;
          onScanSuccess(decodedText);
        } catch (err) {
          console.error("Stop error:", err);
        }
      },
      () => { }
    ).catch(err => {
      console.warn("Camera start warning:", err);
      setStatusMessage("Camera permission denied or camera not found.");
      setScanStatus("ERROR");
    });

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => { });
          scannerRef.current.clear();
          scannerRef.current = null;
        } catch (e) { }
      }
    };
  }, [profile, scanStatus]);

  // Front camera lifecycle
  useEffect(() => {
    let stream = null;
    if (scanStatus === 'SELFIE_REQUIRED') {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        .then(s => {
          stream = s;
          streamRef.current = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(err => {
          console.error("Failed to get front camera", err);
          setStatusMessage("Camera permission denied. Cannot complete selfie verification.");
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [scanStatus]);

  const onScanSuccess = async (decodedText) => {
    try {
      console.log("=== RAW QR DECODED TEXT ===", decodedText);
      let session_id = null;
      let secret = null;

      // Strategy A: JSON / Escaped JSON
      try {
        const parsed = JSON.parse(decodedText.trim());
        session_id = parsed.session_id || parsed.sessionId || parsed.id || parsed.session;
        secret = parsed.secret || parsed.token || parsed.code || parsed.hash;
      } catch {
        // Not JSON
      }

      // Strategy B: URL Query Strings
      if (!session_id || !secret) {
        try {
          const qs = decodedText.includes('?') ? decodedText.split('?')[1] : decodedText;
          const urlParams = new URLSearchParams(qs);
          session_id = urlParams.get('session_id') || urlParams.get('sessionId') || urlParams.get('id');
          secret = urlParams.get('secret') || urlParams.get('token') || urlParams.get('code');
        } catch {
          // Not URL
        }
      }

      // Strategy C: Delimited Strings (e.g. 12:xyz123, 12|xyz123)
      if (!session_id || !secret) {
        const delimiters = [':', '|', '#', ','];
        for (const delim of delimiters) {
          if (decodedText.includes(delim)) {
            const parts = decodedText.split(delim);
            if (parts.length >= 2 && !isNaN(Number(parts[0].trim()))) {
              session_id = parts[0].trim();
              secret = parts[1].trim();
              break;
            }
          }
        }
      }

      if (!session_id || !secret) {
        throw new Error(`Malformed QR payload. Extracted: session_id=${session_id}, secret=${secret}`);
      }

      // Ensure fingerprint is resolved to prevent N+1 proxy escape
      let finalFingerprint = fingerprintRef.current;
      if (!finalFingerprint) {
        try {
          const fp = await fpPromise.load();
          const result = await fp.get();
          finalFingerprint = result.visitorId;
          fingerprintRef.current = finalFingerprint;
          setFingerprintId(finalFingerprint);
        } catch (e) {
          console.warn("Fingerprint failed to load", e);
        }
      }

      const payload = {
        session_id: Number(session_id),
        token: secret.trim(),
        roll_no: profile.roll_no,
        name: profile.name,
        email: profile.email,
        device_id: deviceUuid,
        platform: "ios_web",
        device_fingerprint: finalFingerprint,
        selfie_url: null
      };

      const res = await axios.post(`${API_BASE_URL}/api/attendance/submit`, payload, {
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "69420" }
      });

      if (res.data.status === "SUCCESS") {
        setResponseData(res.data);
        setScanStatus("SUCCESS");
      } else if (res.data.status === "SELFIE_REQUIRED") {
        setFlagReasons(res.data.flag_reasons || []);
        setStatusMessage(res.data.message || "Identity verification required.");
        setPendingPayload(payload);
        setScanStatus("SELFIE_REQUIRED");
      } else {
        throw new Error(res.data.detail || "Failed to mark attendance.");
      }
    } catch (err) {
      console.error(err);
      if (err.response) {
        const detail = err.response.data?.detail || JSON.stringify(err.response.data);
        setStatusMessage(`Backend Rejected (${err.response.status}): ${detail}`);
      } else if (err.request) {
        setStatusMessage(`Response Blocked by Browser: ${err.message}`);
      } else {
        setStatusMessage(`Client Setup Error: ${err.message}`);
      }
      setScanStatus("ERROR");
    }
  };

  const onScanFailure = (error) => {
    // Ignore routine scan failures
  };

  const handleCaptureAndUpload = async () => {
    if (!videoRef.current || !pendingPayload) return;
    setIsUploading(true);
    setStatusMessage('');

    try {
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("Camera not ready or permission denied. Please wait or refresh.");
      }

      // 1. Capture Image
      const canvas = document.createElement('canvas');

      // Calculate scaled dimensions (max width 480px)
      const scale = Math.min(480 / video.videoWidth, 1);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 2. Compress & Convert to Base64 Data URL
      const base64Image = canvas.toDataURL("image/jpeg", 0.5);

      // 3. Re-submit payload
      const payloadWithSelfie = { ...pendingPayload, selfie_url: base64Image };
      const res = await axios.post(`${API_BASE_URL}/api/attendance/submit`, payloadWithSelfie, {
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "69420" }
      });

      if (res.data.status === "SUCCESS") {
        setResponseData(res.data);
        setScanStatus("SUCCESS");
      } else {
        throw new Error(res.data.detail || "Verification failed");
      }

    } catch (err) {
      console.error(err);
      if (err.response) {
        const detail = err.response.data?.detail || JSON.stringify(err.response.data);
        setStatusMessage(`Backend Rejected (${err.response.status}): ${detail}`);
      } else if (err.request) {
        setStatusMessage(`Response Blocked by Browser: ${err.message}`);
      } else {
        setStatusMessage(`Upload Error: ${err.message}`);
      }
      setScanStatus("ERROR"); // MUST explicitly set to ERROR to force UI visibility
    } finally {
      setIsUploading(false);
    }
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    if (!regForm.name || !regForm.roll_no || !regForm.email) return;

    const formatted = {
      ...regForm,
      roll_no: regForm.roll_no.toUpperCase(),
      email: regForm.email.toLowerCase()
    };

    localStorage.setItem('student_profile', JSON.stringify(formatted));
    setProfile(formatted);
    setShowRegistration(false);

    setScanStatus('SCANNING');
  };

  // ─── Android gate ───────────────────────────────────────────────
  if (isAndroid && !isTestBypass) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4">
              <Smartphone size={26} className="text-zinc-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Android Detected</h1>
            <p className="text-zinc-500 text-sm mt-1">Use the native app for best experience.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <a
              href="/app-release.apk"
              className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all"
            >
              <ArrowRight size={16} /> Download Android App
            </a>
            <button
              onClick={() => setIsTestBypass(true)}
              className="w-full py-2.5 text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
            >
              Debug: Continue in browser
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Registration ────────────────────────────────────────────────
  if (showRegistration) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
              <UserPen size={20} className="text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Student Profile</h1>
            <p className="text-zinc-500 text-sm mt-1">Saved locally on this device.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <form onSubmit={handleRegSubmit} className="space-y-4">
              {[
                { label: 'Full Name',     key: 'name',     type: 'text',  placeholder: 'Jane Doe' },
                { label: 'Roll Number',   key: 'roll_no',  type: 'text',  placeholder: '21CS101' },
                { label: 'College Email', key: 'email',    type: 'email', placeholder: 'jane@rajalakshmi.edu.in' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
                  <input
                    type={type}
                    required
                    value={regForm[key]}
                    onChange={e => setRegForm({ ...regForm, [key]: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-800/60 border border-zinc-700/60 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 mt-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
              >
                <CheckCircle2 size={15} /> Save Profile
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Main scanner shell ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center pb-10 text-zinc-100">
      {/* Header */}
      <div className="w-full max-w-sm px-4 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-medium">SmartAttend</p>
            <h1 className="text-lg font-bold text-white mt-0.5">Scan QR Code</h1>
          </div>
          {profile && (
            <button
              onClick={() => {
                setRegForm({ name: profile.name, roll_no: profile.roll_no, email: profile.email });
                setScanStatus('IDLE');
                setShowRegistration(true);
              }}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg transition-all"
            >
              <UserPen size={13} /> Edit Profile
            </button>
          )}
        </div>

        {/* Profile chip */}
        {profile && (
          <div className="mt-3 flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <span className="text-[10px] font-bold text-indigo-400">{profile.name[0].toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile.name}</p>
              <p className="text-[10px] text-zinc-500 font-mono">{profile.roll_no}</p>
            </div>
          </div>
        )}
      </div>

      {/* Status banner */}
      <AnimatePresence>
        {statusMessage && scanStatus !== 'ERROR' && scanStatus !== 'SELFIE_REQUIRED' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full max-w-sm px-4 mb-3"
          >
            <div className="bg-amber-500/8 border border-amber-500/20 text-amber-400 px-3 py-2.5 rounded-xl text-xs text-center">
              {statusMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCANNING ── */}
      <AnimatePresence mode="wait">
        {scanStatus === 'SCANNING' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="w-full max-w-sm px-4"
          >
            <div
              id="reader"
              className="w-full rounded-2xl overflow-hidden border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)] bg-zinc-900"
            />
            <div className="flex items-center justify-center gap-2 mt-5 text-zinc-600 text-sm">
              <ScanLine size={16} className="text-indigo-500 animate-pulse" />
              Point at the teacher's screen
            </div>
          </motion.div>
        )}

        {/* ── SUBMITTING overlay ── */}
        {scanStatus === 'SUBMITTING' && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-50"
          >
            <Loader2 size={40} className="text-indigo-400 animate-spin mb-4" />
            <p className="text-sm font-medium text-zinc-300">Verifying securely…</p>
            <p className="text-xs text-zinc-600 mt-1">Do not close this screen</p>
          </motion.div>
        )}

        {/* ── SUCCESS ── */}
        {scanStatus === 'SUCCESS' && responseData && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm px-4"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Attendance Marked!</h2>
              <p className="text-zinc-500 text-sm mb-5">Your presence has been recorded.</p>

              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-4 space-y-2 text-left mb-5">
                {[
                  ['Course', responseData.course_name],
                  ['Room',   responseData.room],
                  ['Time',   responseData.timestamp && new Date(responseData.timestamp).toLocaleTimeString()],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">{k}</span>
                    <span className="text-sm text-zinc-200 font-medium">{v}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setScanStatus('IDLE')}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}

        {/* ── SELFIE REQUIRED ── */}
        {scanStatus === 'SELFIE_REQUIRED' && (
          <motion.div
            key="selfie"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm px-4"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert size={26} className="text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Identity Check</h2>
              <p className="text-zinc-500 text-xs mb-4">A hardware anomaly was detected. A live photo is required to proceed.</p>

              {flagReasons.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-4 text-left">
                  {flagReasons.map((r, i) => (
                    <p key={i} className="text-[10px] text-amber-400/80 leading-relaxed">• {r}</p>
                  ))}
                </div>
              )}

              {/* Camera viewport */}
              <div className="relative w-44 h-44 mx-auto rounded-full overflow-hidden border-2 border-zinc-700 bg-zinc-800 mb-5">
                <video
                  ref={videoRef}
                  autoPlay playsInline muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                    <Loader2 size={24} className="text-indigo-400 animate-spin" />
                    <p className="text-[10px] text-zinc-400">Sending…</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleCaptureAndUpload}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
                >
                  {isUploading
                    ? <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                    : <><Camera size={15} /> Take Photo &amp; Verify</>
                  }
                </button>
                <button
                  onClick={() => { setPendingPayload(null); setScanStatus('SCANNING'); }}
                  disabled={isUploading}
                  className="w-full py-2.5 text-zinc-500 hover:text-zinc-200 text-sm transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {scanStatus === 'ERROR' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm px-4"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
                <XCircle size={28} className="text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Scan Failed</h2>
              <p className="text-xs text-red-400/80 bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2.5 mb-5 text-left break-words">
                {statusMessage}
              </p>
              <button
                onClick={() => { setStatusMessage(''); setScanStatus('IDLE'); }}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm font-semibold rounded-xl transition-all"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
