import { useState, useEffect, useCallback } from 'react';

export const useAIVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [isMuted, setIsMuted] = useState(() => {
    // SSR Safe Check
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai_voice_muted') === 'true';
    }
    return false;
  });

  // 🚀 FIXED: Web Speech API loads voices asynchronously. 
  // This useEffect ensures we have the premium voices ready before speaking.
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

  const toggleMute = () => {
    setIsMuted((prev) => {
      const newState = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_voice_muted', newState);
        if (newState) window.speechSynthesis.cancel(); // Stop speaking instantly if muted
      }
      return newState;
    });
  };

  const speak = useCallback((text) => {
    if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Stop any ongoing speech before starting a new one
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Optional: Make it sound professional
    utterance.rate = 0.95; // Slightly slower for clarity and premium feel
    utterance.pitch = 1.0; 

    // 🚀 ENHANCED VOICE SELECTION LOGIC
    // Try to find a premium English voice
    const preferredVoice = voices.find(v => 
      v.name.includes('Google UK English Female') || 
      v.name.includes('Google US English') ||
      v.name.includes('Samantha') || // iOS/Mac premium voice
      (v.name.includes('Female') && v.lang.startsWith('en'))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // State management for UI syncing
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isMuted, voices]); 

  const stop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  return { speak, stop, isSpeaking, isMuted, toggleMute };
};