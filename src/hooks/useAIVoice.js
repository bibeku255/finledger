// src/hooks/useAIVoice.js
import { useState, useEffect, useCallback } from 'react';

export const useAIVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false); // Track audio unlock
  const [isMuted, setIsMuted] = useState(() => {
    // SSR Safe Check
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai_voice_muted') === 'true';
    }
    return false;
  });

  // 🚀 Load Voices Asynchronously
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    // Initial fetch
    loadVoices();
    
    // Chrome/Safari require this event listener to fetch voices
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Cleanup: Stop speaking if the app is closed/unmounted
    return () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    };
  }, []);

  // 🚀 Mobile Browser Audio Unlocker
  const initVoice = useCallback(() => {
    if (isInitialized || typeof window === 'undefined') return;
    
    // Play a silent utterance to unlock the audio engine on mobile devices
    const silentUtterance = new SpeechSynthesisUtterance('');
    silentUtterance.volume = 0;
    window.speechSynthesis.speak(silentUtterance);
    setIsInitialized(true);
  }, [isInitialized]);

  // 🚀 Memoized Toggle for Performance
  const toggleMute = useCallback(() => {
    initVoice(); // Unlock audio on manual interaction
    setIsMuted((prev) => {
      const newState = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_voice_muted', newState);
        if (newState) window.speechSynthesis.cancel(); // Stop speaking instantly if muted
      }
      return newState;
    });
  }, [initVoice]);

  // 🚀 Memoized Stop Function
  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text) => {
    if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // 🚀 Safety Check: Clear stuck browser speech queues
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // 🚀 Professional J.A.R.V.I.S Tuning
    utterance.rate = 0.95; // Slightly slower for a calm, premium assistant feel
    utterance.pitch = 1.0; 

    // 🚀 Premium Voice Matching Algorithm
    // Priority: UK Male (JARVIS feel) -> Premium Female -> Default English
    const preferredVoice = voices.find(v => 
      v.name.includes('Daniel') || // Premium Mac UK Male (Very JARVIS)
      v.name.includes('Google UK English Male') ||
      v.name.includes('Samantha') || // Premium Mac US Female
      v.name.includes('Google UK English Female') || 
      v.name.includes('Google US English') ||
      (v.lang === 'en-GB') || 
      (v.lang === 'en-US')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // State management for UI syncing
    utterance.onstart = () => setIsSpeaking(true);
    
    utterance.onend = () => setIsSpeaking(false);
    
    utterance.onerror = (event) => {
      // Ignore 'interrupted' errors caused by user clicking stop/mute
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.warn('J.A.R.V.I.S Engine: Voice synthesis error', event);
      }
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [isMuted, voices]); 

  return { speak, stop, isSpeaking, isMuted, toggleMute, initVoice };
};