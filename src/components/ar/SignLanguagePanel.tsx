import { Languages, X } from "lucide-react";
import { ASLKeyboardPanel } from "./ASLKeyboardPanel";
import { FSLSignRecorder } from "./FSLSignRecorder";
import type { HandState } from "./useHandTracking";

export type SignLanguagePanelProps = {
  recognized: string;
  currentLetter: string | null;
  handsRef: React.MutableRefObject<HandState>;
  onClose: () => void;
};

export function SignLanguagePanel({ recognized, currentLetter, handsRef, onClose }: SignLanguagePanelProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-6">
      <section className="pointer-events-auto relative flex max-h-[88vh] w-[min(700px,92vw)] flex-col overflow-hidden rounded-3xl border border-[rgba(34,255,225,0.38)] bg-[rgba(2,10,20,0.88)] shadow-[0_0_80px_rgba(34,255,225,0.18)] backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(34,255,225,0.35)] bg-[rgba(34,255,225,0.08)]">
              <Languages className="h-5 w-5 text-[rgb(34,255,225)]" />
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-[0.28em] text-[rgb(34,255,225)] uppercase">SIGNSPACE // ASL</p>
              <p className="mt-1 text-xs text-white/45">American Sign Language fingerspelling keyboard</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/10 p-2 text-white/55 transition hover:border-white/25 hover:text-white" aria-label="Close sign language mode">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-6">
          <div className="grid gap-5 pt-6 sm:grid-cols-[1fr_180px]">
            <div className="rounded-2xl border border-[rgba(34,255,225,0.18)] bg-black/25 p-5">
              <p className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">FSL legacy detector</p>
              <p className="mt-3 min-h-16 break-all font-mono text-4xl font-semibold tracking-[0.18em] text-white">
                {recognized || "—"}
              </p>
              <p className="mt-4 font-mono text-[9px] leading-relaxed tracking-wider text-white/40 uppercase">
                The original FSL prototype remains available here. The keyboard below is now an experimental ASL fingerspelling input.
              </p>
            </div>

            <div className="rounded-2xl border border-[rgba(255,90,210,0.22)] bg-[rgba(255,90,210,0.05)] p-5 text-center">
              <p className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">Current FSL</p>
              <p className="mt-2 font-mono text-5xl font-bold text-[rgb(255,90,210)]">{currentLetter ?? "·"}</p>
              <p className="mt-3 font-mono text-[7px] leading-relaxed tracking-wider text-white/25 uppercase">ASL keyboard recognition is independent of this legacy FSL display.</p>
            </div>
          </div>

          <ASLKeyboardPanel handsRef={handsRef} />

          <FSLSignRecorder handsRef={handsRef} />

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase">
              ASL mode: <span className="text-[rgb(255,90,210)]">fingerspell</span> letters to type
            </p>
            <p className="mt-1 font-mono text-[8px] leading-relaxed tracking-wider text-white/30 uppercase">
              Fingerspelling is one part of ASL, not the whole language. This prototype recognizes static handshapes from MediaPipe landmarks; movement-based J/Z and subtle orientation-dependent letters need temporal training for reliable recognition.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
