import React from 'react';
import SetupView from '../components/SetupView';
import QRCodeDisplay from '../components/QRCodeDisplay';
import LiveRoster from '../components/LiveRoster';
import { useSession } from '../context/SessionContext';

export default function LiveView() {
  const { activeSession, createSession } = useSession();

  const handleSessionCreate = async (sessionData) => {
    try {
      await createSession(sessionData);
    } catch (error) {
      console.error('Error creating session', error);
      alert('Failed to create session.');
    }
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <SetupView onCreateSession={handleSessionCreate} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex p-6 gap-6 h-full max-w-[1600px] mx-auto w-full">
      {/* QR Code Panel */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900" />
        <QRCodeDisplay sessionId={activeSession.id} />
      </div>

      {/* Live Roster Panel */}
      <div className="w-96 flex flex-col bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-200" />
        <LiveRoster />
      </div>
    </div>
  );
}
