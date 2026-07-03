import { useState, useEffect, useRef, useCallback } from 'react';

export function useChatSounds() {
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('chat_som_ativo');
    if (stored !== null) {
      setIsMuted(stored === 'false'); // Se chat_som_ativo === 'false', muted é true
    } else {
      setIsMuted(false); // Ativo por padrão
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const novo = !prev;
      localStorage.setItem('chat_som_ativo', (!novo).toString());
      return novo;
    });
  }, []);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const playSent = useCallback(() => {
    if (isMuted) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine'; // Sine/triangle blend with a simple sine for now
    
    // Sweep de 440 a 660 em 90ms
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.09);

    // Envelope (Attack e Decay rápidos)
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, [isMuted, initAudio]);

  const playReceived = useCallback(() => {
    if (isMuted) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Duas notas
    const t0 = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 660;
    gain1.gain.setValueAtTime(0, t0);
    gain1.gain.linearRampToValueAtTime(0.2, t0 + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.12);

    const t1 = t0 + 0.12;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 880;
    gain2.gain.setValueAtTime(0, t1);
    gain2.gain.linearRampToValueAtTime(0.2, t1 + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, t1 + 0.12);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t1);
    osc2.stop(t1 + 0.12);

  }, [isMuted, initAudio]);

  return { isMuted, toggleMute, playSent, playReceived, initAudio };
}
