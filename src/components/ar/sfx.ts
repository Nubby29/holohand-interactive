let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 1.5), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  open() {
    tone(220, 0.45, "sawtooth", 0.06);
    tone(660, 0.35, "sine", 0.05, 0.05);
    tone(990, 0.3, "sine", 0.035, 0.12);
  },
  close() {
    tone(520, 0.25, "sine", 0.04);
    tone(180, 0.3, "sawtooth", 0.04, 0.05);
  },
  hover() {
    tone(1200, 0.08, "sine", 0.02);
  },
  select() {
    tone(880, 0.12, "square", 0.035);
    tone(1320, 0.2, "sine", 0.03, 0.07);
  },
};
