import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div 
      className="bg-red-950/80 text-[#f2efe9] text-xs py-2 px-4 flex items-center justify-center gap-2 border-b border-red-800/40 backdrop-blur-md sticky top-0 z-50 animate-pulse"
      style={{
        backgroundColor: 'rgba(50, 15, 15, 0.9)',
        borderBottom: '1px solid rgba(169, 74, 66, 0.4)',
        fontFamily: 'var(--font-sans)',
        color: '#f2efe9',
        fontSize: '12px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        zIndex: 1000
      }}
    >
      <WifiOff size={14} className="text-[#c9a876]" style={{ color: '#c9a876' }} />
      <span>You are browsing offline. Some images and features may be unavailable.</span>
    </div>
  );
}
