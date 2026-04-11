"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "./button";

interface SpeechInputProps {
  onTranscript: (text: string) => void;
  lang?: string;
  className?: string;
}

export function SpeechInput({ onTranscript, lang = "de-DE", className = "" }: SpeechInputProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SpeechRecognition);
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
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
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, lang, onTranscript]);

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 ${listening ? "text-red-500 bg-red-50 animate-pulse" : "text-muted-foreground hover:text-foreground"} ${className}`}
      onClick={toggle}
      title={listening ? "Aufnahme stoppen" : "Spracheingabe"}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
