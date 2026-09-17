import { Delete, Eraser, Hand, Keyboard, Space, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { classifyASL, isConfidentASL, type ASLClassification } from "./aslFingerspelling";
import type { HandState } from "./useHandTracking";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const STABLE_MS = 520;
const RELEASE_MS = 260;

export function ASLKeyboardPanel({ handsRef }: { handsRef: React.MutableRefObject<HandState> }) {
  const [text, setText] = useState("");
  const [classification, setClassification] = useState<ASLClassification>({ letter: null, confidence: 0, reason: "show an ASL handshape" });
  const [armed, setArmed] = useState(true);
  const candidateRef = useRef<string | null>(null);
  const candidateSinceRef = useRef(0);
  const lastAddedRef = useRef<string | null>(null);
  const neutralSinceRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const hand = handsRef.current.landmarks[0];
      if (!hand) {
        setClassification({ letter: null, confidence: 0, reason: "no hand detected" });
        candidateRef.current = null;
        candidateSinceRef.current = 0;
        neutralSinceRef.current = null;
        setArmed(true);
        return;
      }

      const result = classifyASL(hand);
      setClassification(result);
      const confident = isConfidentASL(result);
      const now = performance.now();

      if (!confident || !result.letter) {
        if (neutralSinceRef.current === null) neutralSinceRef.current = now;
        if (now - neutralSinceRef.current >= RELEASE_MS) {
          candidateRef.current = null;
          candidateSinceRef.current = 0;
          lastAddedRef.current = null;
          setArmed(true);
        }
        return;
      }

      neutralSinceRef.current = null;
      if (candidateRef.current !== result.letter) {
        candidateRef.current = result.letter;
        candidateSinceRef.current = now;
        return;
      }

      if (!armed || now - candidateSinceRef.current < STABLE_MS || lastAddedRef.current === result.letter) return;

      setText((current) => current.length >= 120 ? current : current + result.letter);
      lastAddedRef.current = result.letter;
      setArmed(false);
    };

    loop();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handsRef, armed]);

  const clear = () => setText("");
  const backspace = () => setText((current) => current.slice(0, -1));
  const space = () => setText((current) => current.length >= 120 ? current : `${current} `);

  const confidence = Math.round(classification.confidence * 100);

  return (
    <section className="mt-5 rounded-2xl border border-[rgba(255,90,210,0.28)] bg-[rgba(10,4,18,0.76)] p-4 shadow-[0_0_45px_rgba(255,90,210,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-[rgb(255,90,210)]" />
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[rgb(255,90,210)] uppercase">ASL FINGERSPELL KEYBOARD</p>
            <p className="mt-0.5 font-mono text-[8px] tracking-wider text-white/35 uppercase">Sign a letter · hold steady · release · next letter</p>
          </div>
        </div>
        <span className={`rounded-full border px-2 py-1 font-mono text-[7px] tracking-widest uppercase ${armed ? "border-[rgb(34,255,225)]/30 text-[rgb(34,255,225)]" : "border-[rgb(255,90,210)]/30 text-[rgb(255,90,210)]"}`}>
          {armed ? "armed" : "release sign"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px]">
        <div className="min-h-20 rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-lg tracking-wider text-white">
          <span className="break-words">{text || "Fingerspell something…"}</span>
          {text && <span className="ml-1 inline-block h-5 w-px animate-pulse bg-[rgb(255,90,210)] align-middle" />}
        </div>

        <div className="rounded-xl border border-[rgba(34,255,225,0.18)] bg-black/25 p-3 text-center">
          <Hand className="mx-auto h-5 w-5 text-[rgb(34,255,225)]" />
          <p className="mt-1 font-mono text-[7px] tracking-widest text-white/35 uppercase">Detected</p>
          <p className="mt-1 font-mono text-4xl font-bold text-[rgb(34,255,225)]">{classification.letter ?? "·"}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[rgb(34,255,225)] transition-all" style={{ width: `${confidence}%` }} />
          </div>
          <p className="mt-1 font-mono text-[7px] text-white/35">{confidence}% confidence</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-9">
        {ALPHABET.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => setText((current) => current.length >= 120 ? current : current + letter)}
            className={`h-9 rounded-lg border font-mono text-[10px] transition ${classification.letter === letter ? "border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.18)] text-white shadow-[0_0_16px_rgba(255,90,210,0.25)]" : "border-white/10 bg-white/[0.035] text-white/45 hover:border-white/25 hover:text-white"}`}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        <button type="button" onClick={backspace} className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-3 font-mono text-[8px] text-white/55 hover:text-white"><Delete className="h-3.5 w-3.5" />BACKSPACE</button>
        <button type="button" onClick={space} className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-5 font-mono text-[8px] text-white/55 hover:text-white"><Space className="h-3.5 w-3.5" />SPACE</button>
        <button type="button" onClick={clear} className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-3 font-mono text-[8px] text-white/55 hover:text-white"><Eraser className="h-3.5 w-3.5" />CLEAR</button>
        <button type="button" onClick={() => { if (typeof window !== "undefined" && "speechSynthesis" in window && text) window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); }} className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-3 font-mono text-[8px] text-white/55 hover:text-white"><Volume2 className="h-3.5 w-3.5" />SPEAK</button>
      </div>

      <p className="mt-3 text-center font-mono text-[7px] leading-relaxed tracking-widest text-white/25 uppercase">
        Prototype: ASL fingerspelling uses static handshapes for letters; J and Z require motion and are not yet recognized reliably.
      </p>
    </section>
  );
}
