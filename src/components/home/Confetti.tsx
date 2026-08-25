import { useEffect, useMemo, useState } from "react";

/**
 * A one-shot confetti burst for clearing the last Needs-Me item.
 *
 * Deliberately small: eighteen divs, one animation, no canvas and no library.
 * It unmounts itself when the animation ends, and it is inert under
 * prefers-reduced-motion because the global reduce block collapses every
 * animation to nothing — the pieces would render and vanish in the same frame,
 * so the burst simply does not happen for anyone who asked for less motion.
 */
const COLORS = ["#1407A2", "#3B2FB8", "#8FA0FF", "#12B76A", "#F79009", "#7C3AED"];

export function Confetti({ onDone }: { onDone: () => void }) {
  const [gone, setGone] = useState(false);

  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        // Spread the burst across the card and throw each piece a different way.
        const dx = Math.round((Math.random() - 0.5) * 260);
        const dy = Math.round(90 + Math.random() * 130);
        return {
          id: i,
          left: `${6 + Math.random() * 88}%`,
          color: COLORS[i % COLORS.length],
          delay: `${Math.round(Math.random() * 120)}ms`,
          dx: `${dx}px`,
          dy: `${dy}px`,
          spin: `${Math.round((Math.random() - 0.5) * 720)}deg`,
        };
      }),
    [],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      setGone(true);
      onDone();
    }, 1400);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (gone) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0 overflow-visible" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: p.left,
              background: p.color,
              animationDelay: p.delay,
              "--dx": p.dx,
              "--dy": p.dy,
              "--spin": p.spin,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
