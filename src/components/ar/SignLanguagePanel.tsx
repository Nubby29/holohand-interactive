import { Hand, Languages, X } from "lucide-react";

export type SignLanguagePanelProps = {
  recognized: string;
  currentLetter: string | null;
  onClose: () => void;
};

export function SignLanguagePanel({ recognized, currentLetter, onClose }: SignLanguagePanelProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-6">
      <section className="pointer-events-auto relative flex w-[min(620px,88vw)] flex-col overflow-hidden rounded-3xl border border-[rgba(34,255,225,0.38)] bg-[rgba(2,10,20,0.84)] shadow-[0_0_80px_rgba(34,255,225,0.18)] backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(34,255,225,0.35)] bg-[rgba(34,255,225,0.08)]">
              <Languages className="h-5 w-5 text-[rgb(34,255,225)]" />
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-[0.28em] text-[rgb(34,255,225)] uppercase">FSL SIGNSPACE</p>
              <p className="mt-1 text-xs text-white/45">Filipino Sign Language fingerspelling</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/10 p-2 text-white/55 transition hover:border-white/25 hover:text-white" aria-label="Close sign language mode">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-[1fr_180px]">
          <div className="rounded-2xl border border-[rgba(34,255,225,0.18)] bg-black/25 p-5">
            <p className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">Recognized sequence</p>
            <p className="mt-3 min-h-16 break-all font-mono text-4xl font-semibold tracking-[0.18em] text-white">
              {recognized || "—"}
            </p>
            <p className="mt-4 font-mono text-[9px] leading-relaxed tracking-wider text-white/40 uppercase">
              Hold each handshape briefly. Change to the next letter to continue spelling.
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(255,90,210,0.22)] bg-[rgba(255,90,210,0.05)] p-5 text-center">
            <Hand className="mx-auto h-7 w-7 text-[rgb(255,90,210)]" />
            <p className="mt-3 font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">Current</p>
            <p className="mt-2 font-mono text-5xl font-bold text-[rgb(255,90,210)]">{currentLetter ?? "·"}</p>
          </div>
        </div>

        <div className="border-t border-white/10 px-6 py-4">
          <p className="font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase">
            Prototype launcher: <span className="text-[rgb(34,255,225)]">F + B</span> opens Holo Social
          </p>
        </div>
      </section>
    </div>
  );
}
