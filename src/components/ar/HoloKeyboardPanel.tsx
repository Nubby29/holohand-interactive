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

function getPinchDistance(hand: HandState["landmarks"][number]) {
  const wrist = hand[0];
  const thumb = hand[4];
  const index = hand[8];
  const middleMcp = hand[9];
  if (!wrist || !thumb || !index || !middleMcp) return null;
  const handSize = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.0001;
  return Math.hypot(thumb.x - index.x, thumb.y - index.y) / handSize;
}

export function HoloKeyboardPanel({ handsRef }: { handsRef: React.MutableRefObject<HandState> }) {
  const [text, setText] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [pressing, setPressing] = useState<string | null>(null);
  const keyRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const pinchLockedRef = useRef(false);
  const pressedThisPinchRef = useRef(false);
  const hoverCandidateRef = useRef<string | null>(null);
  const hoverSinceRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const keyMap = useMemo(() => new Map(ALL_KEYS.map((key) => [key.id, key])), []);

  useEffect(() => {
    const pressKey = (id: string) => {
      const key = keyMap.get(id);
      if (!key) return;
      setPressing(id);
      setText((current) => {
        if (key.value === "BACKSPACE") return current.slice(0, -1);
        if (key.value === "CLEAR") return "";
        if (current.length >= 120) return current;
        return current + key.value;
      });
      window.setTimeout(() => setPressing((current) => (current === id ? null : current)), 120);
    };

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const hands = handsRef.current.landmarks;
      const hand = hands[0];
      if (!hand) {
        setHovered(null);
        setTyping(false);
        setPressing(null);
        pinchLockedRef.current = false;
        pressedThisPinchRef.current = false;
        hoverCandidateRef.current = null;
        return;
      }

      const index = hand[8];
      const pinchDistance = getPinchDistance(hand);
      if (!index || pinchDistance === null) return;

      // Match the mirrored webcam pointer used by HoloHand.
      const x = (1 - index.x) * window.innerWidth;
      const y = index.y * window.innerHeight;
      const now = performance.now();

      // Hysteresis prevents landmark jitter from rapidly toggling the pinch state.
      // Engage below 0.38; release only after the fingers separate above 0.58.
      const wasLocked = pinchLockedRef.current;
      const pinch = wasLocked ? pinchDistance < 0.58 : pinchDistance < 0.38;
      setTyping(pinch);

      let hit: string | null = null;
      keyRefs.current.forEach((el, id) => {
        if (hit || !el) return;
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) hit = id;
      });

      if (hit !== hoverCandidateRef.current) {
        hoverCandidateRef.current = hit;
        hoverSinceRef.current = now;
      }
      setHovered(hit);

      if (pinch && !wasLocked) {
        pinchLockedRef.current = true;
        pressedThisPinchRef.current = false;
      }

      // One physical pinch can produce exactly one key press. The aim must remain
      // over the same key for 90ms so crossing a key cannot accidentally type it.
      if (pinch && pinchLockedRef.current && !pressedThisPinchRef.current && hit && now - hoverSinceRef.current >= 90) {
        pressedThisPinchRef.current = true;
        pressKey(hit);
      }

      if (!pinch) {
        pinchLockedRef.current = false;
        pressedThisPinchRef.current = false;
      }
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

      <div className="mt-3 space-y-2 select-none">
        {ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-2">
            {row.map((key) => (
              <button
                key={key.id}
                ref={(el) => keyRefs.current.set(key.id, el)}
                type="button"
                onClick={() => {
                  setText((current) => key.value === "BACKSPACE" ? current.slice(0, -1) : key.value === "CLEAR" ? "" : current.length >= 120 ? current : current + key.value);
                }}
                className={`h-11 rounded-lg border font-mono text-[11px] tracking-wider transition-all ${key.extraWide ? "w-40" : key.wide ? "w-20" : "w-10 sm:w-12"} ${hovered === key.id ? "scale-105 border-[rgb(34,255,225)] bg-[rgba(34,255,225,0.2)] text-white shadow-[0_0_20px_rgba(34,255,225,0.4)]" : "border-white/10 bg-white/[0.035] text-white/55 hover:border-white/25 hover:text-white"} ${pressing === key.id ? "scale-95 border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.28)] shadow-[0_0_28px_rgba(255,90,210,0.6)]" : ""}`}
                aria-label={key.id === "SPACE" ? "Space" : key.id === "BACKSPACE" ? "Backspace" : key.id === "CLEAR" ? "Clear" : key.label}
              >
                {key.id === "BACKSPACE" ? <Delete className="mx-auto h-4 w-4" /> : key.id === "SPACE" ? <span className="flex items-center justify-center gap-1"><Space className="h-3 w-3" />SPACE</span> : key.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-3 text-center font-mono text-[7px] tracking-widest text-white/25 uppercase">Pinch once = one key · release fully · move index finger to aim</p>
    </section>
  );
}
