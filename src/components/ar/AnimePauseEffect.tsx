import { useEffect } from "react";

export type AnimePauseEffectProps = {
  image: string | null;
  onDone: () => void;
};

export function AnimePauseEffect({ image, onDone }: AnimePauseEffectProps) {
  useEffect(() => {
    if (!image) return;
    const timer = window.setTimeout(onDone, 1200);
    return () => window.clearTimeout(timer);
  }, [image, onDone]);

  if (!image) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden bg-black/35">
      <img
        src={image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover brightness-[0.82] contrast-[1.3] saturate-[0.75]"
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_8%,rgba(0,0,0,0.18)_45%,rgba(0,0,0,0.72)_100%)]" />
      <div className="absolute inset-[-45%] animate-[spin_7s_linear_infinite] opacity-35 [background:repeating-conic-gradient(from_0deg,rgba(255,255,255,0.0)_0deg,rgba(255,255,255,0.0)_7deg,rgba(255,255,255,0.2)_7.7deg,rgba(255,255,255,0.0)_9deg)]" />
      <div className="absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(0deg,transparent_0px,transparent_3px,rgba(255,255,255,0.18)_4px)]" />

      <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/65 shadow-[0_0_90px_rgba(255,255,255,0.28)] animate-[ping_1.1s_ease-out_forwards]" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_45px_18px_rgba(255,255,255,0.8)]" />

      <div className="absolute inset-x-0 bottom-[12%] text-center">
        <p className="font-mono text-[clamp(18px,4vw,38px)] font-black italic tracking-[0.32em] text-white uppercase drop-shadow-[0_0_18px_rgba(255,255,255,0.7)]">
          ANIME PAUSE
        </p>
        <div className="mx-auto mt-2 h-px w-48 bg-white/70 shadow-[0_0_14px_rgba(255,255,255,0.8)]" />
        <p className="mt-2 font-mono text-[9px] tracking-[0.5em] text-white/65 uppercase">
          pose locked · effect generated locally
        </p>
      </div>
    </div>
  );
}
