import { useEffect, useRef, useState } from "react";

const JOY_PROMPTS = [
  "What needs me today?",
  "Show today's open shifts",
  "Prepare tomorrow's schedule",
];

function JoySparkle({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="relative"
      aria-hidden="true"
    >
      <path d="M8 2l1.2 3.4L12.6 6.6 9.2 7.8 8 11.2 6.8 7.8 3.4 6.6 6.8 5.4z" />
      <path d="M12.4 10.6l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" />
    </svg>
  );
}

/**
 * The Ask Joy pill and its floating panel, to the approved mock's values:
 * the indigo gradient pill bottom-right with the glowing sparkle and the ⌘J
 * chip, opening a 344px card — three starter prompts that fill the input, a
 * mic that shows "Listening…", and an indigo send.
 *
 * Voice capture and answers are not wired in the prototype — the mic is a
 * visual state and send clears the input, exactly as the mock behaves. The
 * BriefBand's "Talk to Joy AI" card opens this panel via the "joy:open"
 * event, and ⌘J / Ctrl+J toggles it, as the chip promises.
 */
export function AskJoy() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [mic, setMic] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = () => {
    const text = q.trim();
    setQ("");
    setMic(false);
    if (text) {
      // A real question graduates to the full Command Center, which owns
      // threads, tools and approvals — one AI surface, two doors.
      setOpen(false);
      document.dispatchEvent(new CustomEvent("joy:ask", { detail: { question: text } }));
    }
  };

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
        setMic(false);
      }
    };
    document.addEventListener("joy:open", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("joy:open", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Ask Joy"
          className="fixed bottom-[88px] right-9 z-[45] flex w-[344px] flex-col overflow-hidden rounded-2xl border border-[#ECECF1] bg-white shadow-[0_16px_44px_rgba(25,26,46,.16)]"
        >
          <div className="flex items-center gap-2.5 border-b border-[#F3F3F6] px-4 py-3.5">
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[#191A2E]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#8FA0FF]"
                style={{ animation: "joyGlow 2.6s ease-in-out infinite" }}
                aria-hidden="true"
              />
            </span>
            <span className="text-[13.5px] font-medium text-[#191A2E]">Ask Joy</span>
            {mic && (
              <span className="text-[11px] text-primary" role="status">
                Listening…
              </span>
            )}
            <button
              type="button"
              aria-label="Close Ask Joy"
              onClick={() => {
                setOpen(false);
                setMic(false);
              }}
              className="ml-auto h-6 w-6 flex-none rounded-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-[#F1F2F6] hover:text-[#191A2E]"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-px p-2">
            {JOY_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setQ(prompt);
                  inputRef.current?.focus();
                }}
                className="rounded-[9px] px-2.5 py-[9px] text-left text-[12.5px] leading-[1.4] text-[#5B6274] transition-colors hover:bg-[#FAFAFB] hover:text-[#191A2E]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-[#F3F3F6] bg-[#FCFCFD] px-3 py-2.5">
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Ask about anything on this page"
              aria-label="Ask Joy a question"
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-[#191A2E] outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              title="Speak to Joy"
              aria-label="Speak to Joy"
              aria-pressed={mic}
              onClick={() => setMic((v) => !v)}
              className={
                mic
                  ? "flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] border border-primary bg-[#EEF0FE] text-primary"
                  : "flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] border border-[#ECECF1] bg-white text-muted-foreground"
              }
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <rect x="6" y="2" width="4" height="7" rx="2" />
                <path d="M4 7.4a4 4 0 008 0M8 11.4V14" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Send to Joy"
              onClick={send}
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-primary text-white transition-colors hover:bg-[#2A1BD1]"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 13V3M4 6.6L8 2.8l4 3.8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setMic(false);
        }}
        className="fixed bottom-[30px] right-9 z-50 flex h-[46px] items-center gap-[11px] rounded-[23px] pl-4 pr-2 text-[13.5px] font-medium text-white shadow-[0_2px_6px_rgba(20,7,162,.2),0_12px_32px_rgba(20,7,162,.28)] transition-[transform,box-shadow] duration-[.18s] hover:-translate-y-0.5 hover:shadow-[0_3px_8px_rgba(20,7,162,.24),0_18px_44px_rgba(20,7,162,.34)]"
        style={{ background: "linear-gradient(135deg,#2A1BD1 0%,#1407A2 100%)" }}
      >
        <span className="relative flex h-[22px] w-[22px] flex-none items-center justify-center">
          <span
            className="absolute -inset-0.5 rounded-full"
            style={{
              background: "radial-gradient(circle,rgba(255,255,255,.4),transparent 70%)",
              animation: "joyGlow 3.4s ease-in-out infinite",
            }}
            aria-hidden="true"
          />
          <JoySparkle />
        </span>
        Ask Joy
        <span className="flex h-6 flex-none items-center justify-center rounded-[14px] bg-white/[.18] px-2 text-[11px] font-medium tracking-[.02em] text-white/[.82]">
          ⌘J
        </span>
      </button>
    </>
  );
}
