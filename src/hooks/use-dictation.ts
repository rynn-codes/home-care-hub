import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictation through the browser's own speech recognition.
 *
 * Nothing leaves the page except through the browser's built-in service —
 * there is no Joy transcription server. Chrome, Edge and Safari support it;
 * Firefox does not, and the hook says so instead of pretending.
 *
 * The published prototype runs inside a preview frame, and browsers refuse
 * the microphone to a framed page. That is the case the messages below spend
 * the most words on, because it is the one Karynn hits.
 */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function inPreviewFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export const MIC_BLOCKED_IN_FRAME =
  "The browser blocks the microphone for a page inside a preview frame, so dictation can't run here. Type or paste what was said — Joy reads it exactly the same way.";

function describeError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return inPreviewFrame() ? MIC_BLOCKED_IN_FRAME : "Microphone access was blocked. Allow the mic for this page, then try again.";
    case "no-speech":
      return "Nothing was picked up. Check the mic is on and speak a little louder.";
    case "audio-capture":
      return "No microphone found. Plug one in or pick one in your system settings.";
    case "network":
      return "Speech recognition needs a connection and could not reach the service.";
    case "aborted":
      return "";
    default:
      return "Dictation stopped unexpectedly. Try again.";
  }
}

export interface Dictation {
  supported: boolean;
  blocked: boolean;
  listening: boolean;
  /** Everything finalised so far, as one string. */
  transcript: string;
  /** What the recogniser is still deciding on. */
  interim: string;
  error: string;
  start(): void;
  stop(): void;
  toggle(): void;
  reset(): void;
}

export function useDictation(onTranscript?: (text: string) => void): Dictation {
  const ctor = recognitionCtor();
  const supported = ctor !== null;
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!inPreviewFrame()) return;
    let live = true;
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (live && status.state === "denied") setBlocked(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const ref = useRef<Recognition | null>(null);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;

  const stop = useCallback(() => {
    ref.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!ctor) {
      setError("This browser cannot do dictation. Chrome, Edge or Safari can.");
      return;
    }
    if (blocked) {
      setError(MIC_BLOCKED_IN_FRAME);
      return;
    }
    setError("");
    setInterim("");
    const r = new ctor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let final = "";
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) final += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (final) {
        setTranscript((prev) => {
          const next = (prev + final).replace(/\s+/g, " ").trimStart();
          callback.current?.(next);
          return next;
        });
      }
      setInterim(pending);
    };
    r.onerror = (e) => {
      const message = describeError(e.error);
      if (message) setError(message);
      setListening(false);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    ref.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(true);
    }
  }, [ctor, blocked]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError("");
  }, []);

  useEffect(() => () => ref.current?.abort(), []);

  return { supported, blocked, listening, transcript, interim, error, start, stop, toggle, reset };
}
