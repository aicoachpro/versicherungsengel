"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "./button";

interface SpeechInputProps {
  onTranscript: (text: string) => void;
  lang?: string;
  className?: string;
}

const BAR_COUNT = 5;

export function SpeechInput({ onTranscript, lang = "de-DE", className = "" }: SpeechInputProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SpeechRecognition);
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setLevels(Array(BAR_COUNT).fill(0));
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const startVisualizer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteFrequencyData(data);
        const step = Math.floor(data.length / BAR_COUNT);
        const bars: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j];
          bars.push(Math.min(1, sum / step / 140));
        }
        setLevels(bars);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Visualizer fehlgeschlagen — Aufnahme laeuft trotzdem weiter
    }
  }, []);

  const toggle = useCallback(async () => {
    if (listening) {
      recognitionRef.current?.stop();
      cleanup();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = Array.from(event.results);
      const transcript = results
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onTranscript(transcript);
    };

    recognition.onerror = () => {
      cleanup();
      setListening(false);
    };

    recognition.onend = () => {
      cleanup();
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    startVisualizer();
  }, [listening, lang, onTranscript, startVisualizer, cleanup]);

  if (!supported) return null;

  if (listening) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 pl-2 pr-1 py-1 ${className}`}
      >
        <div className="flex items-center gap-0.5 h-6 w-14 sm:w-16">
          {levels.map((l, i) => (
            <div
              key={i}
              className="flex-1 bg-red-500 rounded-sm"
              style={{
                height: `${Math.max(12, l * 100)}%`,
                transition: "height 80ms linear",
              }}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-red-600 hidden sm:inline">Aufnahme</span>
        <button
          type="button"
          onClick={toggle}
          className="h-9 w-9 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-transform"
          title="Aufnahme stoppen"
          aria-label="Aufnahme stoppen"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-11 w-11 sm:h-9 sm:w-9 p-0 text-muted-foreground hover:text-foreground ${className}`}
      onClick={toggle}
      title="Spracheingabe"
      aria-label="Spracheingabe starten"
    >
      <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
    </Button>
  );
}
