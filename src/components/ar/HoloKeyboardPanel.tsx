import { useEffect, useMemo, useRef, useState } from "react";
import { Delete, Keyboard, Space } from "lucide-react";
import type { HandState } from "./useHandTracking";

type KeyDef = { id: string; label: string; value: string; wide?: boolean; extraWide?: boolean };

const ROWS: KeyDef[][] = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"].map((k) => ({ id: k, label: k, value: k })),
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"].map((k) => ({ id: k, label: k, value: k })),
  ["Z", "X", "C", "V", "B", "N", "M"].map((k) => ({ id: k, label: k, value: k })),
  [
    { id: "BACKSPACE", label: "⌫", value: "BACKSPACE", wide: true },
    { id: "SPACE", label: "SPACE", value: " ", extraWide: true },
    { id: "CLEAR", label: "CLR", value: "CLEAR", wide: true },
  ],
];

const ALL_KEYS = ROWS.flat();

function isPinching(hand: HandState["landmarks"][number]) {
  const wrist = hand[0];
  const thumb = hand[4];
  const index = hand[8];
  const middleMcp = hand[9];
  if (!wrist || !thumb || !index || !middleMcp) return false;
  const handSize = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.0001;
  return Math.hypot(thumb.x - index.x, thumb.y - index.y) / handSize < 0.45;
}

export function HoloKeyboardPanel({ handsRef }: { handsRef: React.MutableRefObject<HandState> }) {
  const [text, setText] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const keyRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const previousPinchRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const keyMap = useMemo(() => new Map(ALL_KEYS.map((key) => [key.id, key])), []);

  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const hands = handsRef.current.landmarks;
      const hand = hands[0];
      if (!hand) {
        setHovered(null);
        setTyping(false);
        previousPinchRef.current = false;
        return;
      }

      const index = hand[8];
      if (!index) return;

      // Match the mirrored webcam pointer used by HoloHand.
      const x = (1 - index.x) * window.innerWidth;
      const y = index.y * window.innerHeight;
      const pinch = isPinching(hand);
      let hit: string | null = null;

      keyRefs.current.forEach((el, id) => {
        if (hit || !el) return;
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) hit = id;
      });

      setHovered(hit);
      setTyping(pinch);

      // A pinch transition is a single key press. Holding the pinch does not repeat.
      if (pinch && !previousPinchRef.current && hit) {
        const key = keyMap.get(hit);
        if (key) {
          setText((current) => {
            if (key.value === "BACKSPACE") return current.slice(0, -1);
            if (key.value === "CLEAR") return "";
            if (current.length >= 120) return current;
            return current + key.value;
          });
        }
      }

      previousPinchRef.current = pinch;
    };

    loop();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handsRef, keyMap]);

  return (
    <section className="mt-5 rounded-2xl border border-[rgba(34,255,225,0.25)] bg-[rgba(0,8,16,0.72)] p-4 shadow-[0_0_45px_rgba(34,255,225,0.08)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-[rgb(34,255,225)]" />
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[rgb(34,255,225)] uppercase">HANDSPACE KEYBOARD</p>
            <p className="mt-0.5 font-mono text-[8px] tracking-wider text-white/35 uppercase">Point at a key · pinch to type</p>
          </div>
        </div>
        <span className={`rounded-full border px-2 py-1 font-mono text-[7px] tracking-widest uppercase ${typing ? "border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.12)] text-[rgb(255,90,210)]" : "border-white/10 text-white/35"}`}>
          {typing ? "pinching" : "ready"}
        </span>
      </div>

      <div className="min-h-14 rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-lg tracking-wider text-white shadow-inner">
        <span className="break-words">{text || "Type something with your hand…"}</span>
        {text && <span className="ml-1 inline-block h-5 w-px animate-pulse bg-[rgb(34,255,225)] align-middle" />}
      </div>

      <div className="mt-3 space-y-1.5 select-none">
        {ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-1.5">
            {row.map((key) => (
              <button
                key={key.id}
                ref={(el) => keyRefs.current.set(key.id, el)}
                type="button"
                onClick={() => {
                  setText((current) => key.value === "BACKSPACE" ? current.slice(0, -1) : key.value === "CLEAR" ? "" : current + key.value);
                }}
                className={`h-9 rounded-lg border font-mono text-[10px] tracking-wider transition-all ${key.extraWide ? "w-36" : key.wide ? "w-16" : "w-8 sm:w-10"} ${hovered === key.id ? "scale-105 border-[rgb(34,255,225)] bg-[rgba(34,255,225,0.2)] text-white shadow-[0_0_20px_rgba(34,255,225,0.4)]" : "border-white/10 bg-white/[0.035] text-white/55 hover:border-white/25 hover:text-white"}`}
                aria-label={key.id === "SPACE" ? "Space" : key.id === "BACKSPACE" ? "Backspace" : key.id === "CLEAR" ? "Clear" : key.label}
              >
                {key.id === "BACKSPACE" ? <Delete className="mx-auto h-3.5 w-3.5" /> : key.id === "SPACE" ? <span className="flex items-center justify-center gap-1"><Space className="h-3 w-3" />SPACE</span> : key.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-3 text-center font-mono text-[7px] tracking-widest text-white/25 uppercase">Pinch once = one key · move index finger to aim</p>
    </section>
  );
}
