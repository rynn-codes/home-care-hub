import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MIC_BLOCKED_IN_FRAME, inPreviewFrame, useDictation } from "@/hooks/use-dictation";

/**
 * Dictation needs two separate things — a microphone the browser will open,
 * and a speech recogniser the browser implements — and they fail for
 * different reasons. This tests them one at a time and says what it found,
 * because "dictation doesn't work" was the whole bug report.
 */
type CheckState = "unknown" | "checking" | "pass" | "fail";
interface Check {
  label: string;
  state: CheckState;
  detail: string;
}

function browserName(): string {
  if (typeof navigator === "undefined") return "this browser";
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "this browser";
}

export function MicrophoneCheck() {
  const dictation = useDictation();
  const [level, setLevel] = useState(0);
  const [mic, setMic] = useState<Check>({ label: "Microphone", state: "unknown", detail: "Not checked yet." });
  const [heard, setHeard] = useState("");
  const [speech, setSpeech] = useState<Check>({ label: "Speech recognition", state: "unknown", detail: "Not checked yet." });
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audio.current?.close();
    audio.current = null;
    setLevel(0);
  };
  useEffect(() => stop, []);

  const browser = browserName();
  const framed = inPreviewFrame();

  const testMic = async () => {
    stop();
    setMic({ label: "Microphone", state: "checking", detail: "Asking the browser…" });
    if (!navigator.mediaDevices?.getUserMedia) {
      setMic({
        label: "Microphone",
        state: "fail",
        detail: `${browser} does not offer microphone access to this page at all. On a phone or an older browser that usually means the page is not on https.`,
      });
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const ctx = new AudioContext();
      audio.current = ctx;
      const source = ctx.createMediaStreamSource(s);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevel(peak);
        frame.current = requestAnimationFrame(tick);
      };
      tick();
      const label = s.getAudioTracks()[0]?.label;
      setMic({
        label: "Microphone",
        state: "pass",
        detail: label ? `Open and listening — ${label}. Speak and the bar below should move.` : "Open and listening. Speak and the bar below should move.",
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "unknown";
      setMic({
        label: "Microphone",
        state: "fail",
        detail:
          name === "NotAllowedError"
            ? framed
              ? "Refused, and inside this frame it always will be — a page cannot grant itself the microphone. Open Joy in its own tab and try again."
              : `Refused. ${browser} is blocking the mic for this page — check the padlock in the address bar and allow the microphone, then run this again.`
            : name === "NotFoundError"
              ? "No microphone found on this device."
              : name === "NotReadableError"
                ? "The microphone is there but something else is holding it — a call or a recorder, usually."
                : `Could not open the microphone (${name}).`,
      });
    }
  };

  const testSpeech = () => {
    setHeard("");
    if (!dictation.supported) {
      setSpeech({
        label: "Speech recognition",
        state: "fail",
        detail: `${browser} does not implement the Web Speech API, so dictation cannot run here whatever the microphone does. ${
          browser === "Firefox" ? "Firefox has never shipped it. Chrome, Edge or Safari will work." : "Chrome, Edge or Safari will work."
        }`,
      });
      return;
    }
    setSpeech({ label: "Speech recognition", state: "checking", detail: "Listening — say a few words." });
    dictation.reset();
    dictation.start();
  };

  useEffect(() => {
    if (speech.state !== "checking") return;
    if (dictation.error) {
      setSpeech({ label: "Speech recognition", state: "fail", detail: dictation.error });
      return;
    }
    if (dictation.transcript) {
      setHeard(dictation.transcript);
      setSpeech({ label: "Speech recognition", state: "pass", detail: "Working. What it heard is below." });
      dictation.stop();
    }
  }, [dictation, speech.state]);

  const secure = typeof window !== "undefined" && window.isSecureContext;
  const checks: Check[] = [
    {
      label: "Where this page is running",
      state: framed ? "fail" : "pass",
      detail: framed
        ? "Inside another page's frame. The microphone is refused here before anybody is asked, and no change to Joy can lift that."
        : "In its own tab, so the browser will ask you for the microphone normally.",
    },
    {
      label: "Secure connection",
      state: secure ? "pass" : "fail",
      detail: secure ? "https — microphones are allowed." : "Not https. Browsers refuse the microphone on insecure pages.",
    },
    {
      label: `Speech recognition in ${browser}`,
      state: dictation.supported ? "pass" : "fail",
      detail: dictation.supported ? "This browser implements it." : `${browser} does not implement it. Chrome, Edge or Safari do.`,
    },
    mic,
    speech,
  ];
  const icon = (state: CheckState) =>
    state === "pass" ? (
      <Check className="h-3.5 w-3.5 text-[#0B7268]" aria-hidden="true" />
    ) : state === "fail" ? (
      <X className="h-3.5 w-3.5 text-[#B42318]" aria-hidden="true" />
    ) : (
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
    );

  return (
    <div className="space-y-4 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-6">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Microphone check</h2>
        <p className="m-0 text-[13px] text-muted-foreground [text-wrap:pretty]">
          Dictation needs two separate things to work, and they fail for different reasons. This tests them one at a time
          and says exactly what it found.
        </p>
      </div>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2.5 rounded-[10px] bg-[var(--paper-sunken)] px-3.5 py-2.5">
            <span className="mt-[3px] flex h-3.5 w-3.5 flex-none items-center justify-center">{icon(c.state)}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] font-medium">{c.label}</span>
              <span className="text-[12.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {mic.state === "pass" && (
        <div className="space-y-1.5">
          <p className="m-0 text-[12px] font-medium">Input level</p>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--wash-strong)]">
            <div className="h-full rounded-full bg-[#0B7268] transition-[width] duration-75" style={{ width: `${Math.min(100, Math.round(level * 160))}%` }} />
          </div>
          <p className="m-0 text-[12px] text-muted-foreground">{level > 0.04 ? "Hearing you." : "Silent — say something."}</p>
        </div>
      )}
      {heard && (
        <p className="m-0 rounded-[10px] border border-[#A6E3C4] bg-[#F3FAF5] px-3.5 py-2.5 text-[13px]">Heard: “{heard}”</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={testMic}>
          <Mic className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {mic.state === "pass" ? "Check again" : "Test the microphone"}
        </Button>
        <Button size="sm" onClick={testSpeech} disabled={speech.state === "checking"}>
          {speech.state === "checking" ? "Listening…" : "Test dictation"}
        </Button>
        {mic.state === "pass" && (
          <Button variant="ghost" size="sm" onClick={stop}>
            Stop listening
          </Button>
        )}
        {framed && (
          <a
            href={typeof window === "undefined" ? "#" : window.location.href}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary underline-offset-4 hover:underline"
          >
            Open Joy in its own tab
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
      <p className={cn("m-0 border-t border-[var(--hairline-soft)] pt-3 text-[12px] leading-[1.55] text-muted-foreground [text-wrap:pretty]")}>
        {framed ? `${MIC_BLOCKED_IN_FRAME} ` : ""}
        Dictation is the browser's own transcription — the audio goes to whoever makes the browser, not to Joy, and Joy never
        records or keeps it. Typing what was said produces exactly the same result everywhere.
      </p>
    </div>
  );
}
