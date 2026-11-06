import { useCallback, useRef, useState } from 'react';

type AudioContextCtor = new () => AudioContext;

function audioContextClass(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
}

/**
 * A bell for staff screens. Browsers only play sound on a page that has been tapped once,
 * so a screen calls enable() from a tap ("Tap to enable sound") before ring() can be heard.
 */
export function useBell() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const enable = useCallback(async () => {
    const Ctx = audioContextClass();
    if (!Ctx) return false;
    try {
      if (!ctxRef.current) ctxRef.current = new Ctx();
      await ctxRef.current.resume?.();
      setEnabled(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Two short tones; 'alert' is lower and repeats, for things that are late. */
  const ring = useCallback((kind: 'bell' | 'alert' = 'bell') => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      const notes = kind === 'alert' ? [440, 330, 440, 330] : [880, 1175];
      notes.forEach((freq, i) => {
        const at = ctx.currentTime + i * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, at);
        gain.gain.setValueAtTime(0.3, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.3);
      });
    } catch {
      // Sound is a bonus; the banner still shows
    }
  }, []);

  return { enabled, enable, ring };
}
