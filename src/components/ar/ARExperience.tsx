import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Hand, Languages, Layers, Radio, Settings2, Sparkles, Users } from "lucide-react";
import { HandOverlay } from "./HandOverlay";
import { SignLanguagePanel } from "./SignLanguagePanel";
import { SocialARPanel } from "./SocialARPanel";
import { AnimePauseEffect } from "./AnimePauseEffect";
import { useHandTracking } from "./useHandTracking";
import { sfx } from "./sfx";

const MENU_ITEMS = [
  { id: "scan", label: "SCAN", desc: "Spatial Scan", Icon: Radio, angle: -90 },
  { id: "social", label: "SOCIAL", desc: "Holo Social", Icon: Users, angle: -30 },
  { id: "layers", label: "LAYERS", desc: "Holo Layers", Icon: Layers, angle: 30 },
  { id: "fx", label: "FX", desc: "Anime Pause", Icon: Sparkles, angle: 90 },
  { id: "calib", label: "CALIB", desc: "Re-centre", Icon: Settings2, angle: 150 },
  { id: "sign", label: "SIGN", desc: "ASL / FSL", Icon: Languages, angle: 210 },
];

export default function ARExperience() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [hud, setHud] = useState(true);
  const [fxEnabled, setFxEnabled] = useState(false);
  const [animePause, setAnimePause] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [recognizedSigns, setRecognizedSigns] = useState("");

  const handleTwoFingerHold = useCallback(() => {
    if (socialOpen) {
      sfx.close();
      setSocialOpen(false);
      setActive(null);
    } else if (signOpen) {
      sfx.close();
      setSignOpen(false);
      setRecognizedSigns("");
      setActive(null);
    } else {
      setMenuOpen((open) => {
        if (open) {
          sfx.close();
          setActive(null);
          return false;
        }
        sfx.open();
        return true;
      });
    }
    setFlash(true);
    window.setTimeout(() => setFlash(false), 700);
  }, [socialOpen, signOpen]);

  const handleCloseGesture = useCallback(() => {
    if (!menuOpen && !socialOpen && !signOpen) return;

    sfx.close();
    setMenuOpen(false);
    setSocialOpen(false);
    setSignOpen(false);
    setRecognizedSigns("");
    setActive(null);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 700);
  }, [menuOpen, socialOpen, signOpen]);

  const {
    videoRef,
    handsRef,
    status,
    error,
    handPresent,
    swipeProgress,
    pointer,
    pinchPulse,
    pinching,
    fslLetter,
    start,
  } = useHandTracking(handleTwoFingerHold, handleCloseGesture);

  const targetsRef = useRef<Map<string, HTMLElement | null>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverSoundRef = useRef<string | null>(null);
  const scrollPointerRef = useRef<{ x: number; y: number } | null>(null);
  const signSequenceRef = useRef("");
  const signResetRef = useRef<number | null>(null);
  const fxPoseRef = useRef<{
    signature: number[] | null;
    stableSince: number | null;
    armed: boolean;
    lastTrigger: number;
  }>({ signature: null, stableSince: null, armed: true, lastTrigger: 0 });
  const setTarget = useCallback((id: string) => (el: HTMLElement | null) => targetsRef.current.set(id, el), []);

  const captureAnimePause = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setAnimePause(canvas.toDataURL("image/jpeg", 0.82));
    sfx.select();
  }, [videoRef]);

  const activate = useCallback((id: string) => {
    sfx.select();
    setActive(id);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 500);

    if (id === "fx") {
      setFxEnabled((enabled) => !enabled);
      setMenuOpen(false);
      return;
    }

    if (id === "social") {
      setMenuOpen(false);
      setSignOpen(false);
      setRecognizedSigns("");
      signSequenceRef.current = "";
      setSocialOpen(true);
      return;
    }

    if (id === "sign") {
      setMenuOpen(false);
      setSocialOpen(false);
      setRecognizedSigns("");
      signSequenceRef.current = "";
      setSignOpen(true);
    }
  }, []);

  const closeSocial = useCallback(() => {
    sfx.close();
    setSocialOpen(false);
    setActive(null);
  }, []);

  const closeSign = useCallback(() => {
    sfx.close();
    setSignOpen(false);
    setRecognizedSigns("");
    signSequenceRef.current = "";
    setActive(null);
  }, []);

  useEffect(() => {
    if (!signOpen || !fslLetter) return;

    const current = signSequenceRef.current;
    if (current.endsWith(fslLetter)) return;

    const next = `${current}${fslLetter}`.slice(-8);
    signSequenceRef.current = next;
    setRecognizedSigns(next);
    sfx.hover();

    if (signResetRef.current) window.clearTimeout(signResetRef.current);
    signResetRef.current = window.setTimeout(() => {
      signSequenceRef.current = "";
      setRecognizedSigns("");
      signResetRef.current = null;
    }, 2200);

    if (next.endsWith("FB")) {
      window.setTimeout(() => activate("social"), 250);
    }
  }, [fslLetter, signOpen, activate]);

  useEffect(() => () => {
    if (signResetRef.current) window.clearTimeout(signResetRef.current);
  }, []);

  // FX mode watches the live landmarks. A pose must remain stable before it is
  // treated as an "iconic pause". Movement re-arms the trigger for the next pose.
  useEffect(() => {
    if (!fxEnabled || status !== "ready") {
      fxPoseRef.current.signature = null;
      fxPoseRef.current.stableSince = null;
      return;
    }

    const landmarks = handsRef.current.landmarks;
    if (!landmarks.length) {
      fxPoseRef.current.signature = null;
      fxPoseRef.current.stableSince = null;
      fxPoseRef.current.armed = true;
      return;
    }

    const signature = landmarks.flatMap((hand) => {
      const wrist = hand[0];
      const middleMcp = hand[9];
      if (!wrist || !middleMcp) return [];
      const scale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.0001;
      return [
        ...[4, 8, 12, 16, 20].flatMap((index) => {
          const point = hand[index];
          if (!point) return [];
          return [(point.x - wrist.x) / scale, (point.y - wrist.y) / scale];
        }),
      ];
    });

    if (!signature.length) return;

    const previous = fxPoseRef.current.signature;
    fxPoseRef.current.signature = signature;
    if (!previous || previous.length !== signature.length) {
      fxPoseRef.current.stableSince = performance.now();
      return;
    }

    const drift = signature.reduce((sum, value, index) => sum + Math.abs(value - previous[index]), 0) / signature.length;
    const now = performance.now();

    if (drift > 0.055) {
      fxPoseRef.current.armed = true;
      fxPoseRef.current.stableSince = now;
      return;
    }

    if (fxPoseRef.current.stableSince === null) fxPoseRef.current.stableSince = now;

    if (fxPoseRef.current.armed && now - fxPoseRef.current.stableSince >= 650 && now - fxPoseRef.current.lastTrigger > 1800) {
      fxPoseRef.current.armed = false;
      fxPoseRef.current.lastTrigger = now;
      captureAnimePause();
    }
  }, [fxEnabled, pointer, status, handsRef, captureAnimePause]);

  useEffect(() => {
    const interactionOpen = menuOpen || socialOpen;
    if (!interactionOpen || !pointer.active) {
      setHovered(null);
      hoverSoundRef.current = null;
      return;
    }

    let found: string | null = null;
    targetsRef.current.forEach((el, id) => {
      if (!el || found) return;
      const r = el.getBoundingClientRect();
      if (pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom) found = id;
    });

    setHovered(found);
    if (found && hoverSoundRef.current !== found) {
      hoverSoundRef.current = found;
      sfx.hover();
    }
    if (!found) hoverSoundRef.current = null;
  }, [pointer, menuOpen, socialOpen]);

  useEffect(() => {
    const interactionOpen = menuOpen || socialOpen;
    if (pinchPulse && interactionOpen && hovered) activate(hovered);
  }, [pinchPulse, menuOpen, socialOpen, hovered, activate]);

  useEffect(() => {
    if (!socialOpen || !pointer.active || !pinching) {
      scrollPointerRef.current = null;
      return;
    }

    const previous = scrollPointerRef.current;
    scrollPointerRef.current = { x: pointer.x, y: pointer.y };
    if (!previous) return;

    const dy = pointer.y - previous.y;
    if (Math.abs(dy) < 0.2) return;

    const element = document.elementFromPoint(pointer.x, pointer.y);
    let node: HTMLElement | null = element instanceof HTMLElement ? element : null;
    while (node) {
      const canScroll = node.scrollHeight > node.clientHeight + 2;
      const style = window.getComputedStyle(node);
      if (canScroll && (style.overflowY === "auto" || style.overflowY === "scroll")) {
        node.scrollTop = Math.max(0, Math.min(node.scrollHeight - node.clientHeight, node.scrollTop - dy * 1.6));
        break;
      }
      node = node.parentElement;
    }
  }, [pointer, pinching, socialOpen]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(2,6,16,0.78)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(0deg,rgba(34,255,225,0.14)_0px,rgba(34,255,225,0.14)_1px,transparent_1px,transparent_4px)]" />
      <HandOverlay handsRef={handsRef} enabled={hud && status === "ready"} />
      {flash && <div className="pointer-events-none absolute inset-0 z-50 animate-[pulse_0.6s_ease-out] bg-[rgba(34,255,225,0.1)]" />}
      <AnimePauseEffect image={animePause} onDone={() => setAnimePause(null)} />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 p-5">
        <div><h1 className="font-mono text-sm tracking-[0.35em] text-[rgb(34,255,225)] uppercase">Aurora // Handspace</h1><p className="mt-1 font-mono text-[11px] tracking-widest text-white/50 uppercase">gesture interface v3.0 · ASL + FX</p></div>
        <div className="flex items-center gap-2"><StatusPill label={status === "ready" ? (handPresent ? "hand locked" : "scanning") : status} on={status === "ready" && handPresent} /><button onClick={() => { sfx.hover(); setFxEnabled(v => !v); }} className={`rounded-full border px-4 py-2 font-mono text-[10px] tracking-widest uppercase backdrop-blur transition ${fxEnabled ? "border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.14)] text-[rgb(255,90,210)]" : "border-[rgba(34,255,225,0.35)] bg-black/35 text-[rgb(34,255,225)] hover:bg-[rgba(34,255,225,0.12)]"}`}>FX {fxEnabled ? "on" : "off"}</button><button onClick={() => { sfx.hover(); setHud(v => !v); }} className="rounded-full border border-[rgba(34,255,225,0.35)] bg-black/35 px-4 py-2 font-mono text-[10px] tracking-widest text-[rgb(34,255,225)] uppercase backdrop-blur transition hover:bg-[rgba(34,255,225,0.12)]">HUD {hud ? "on" : "off"}</button></div>
      </header>

      {status !== "ready" && <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm"><div className="max-w-md rounded-2xl border border-[rgba(34,255,225,0.35)] bg-black/60 p-8 text-center shadow-[0_0_60px_rgba(34,255,225,0.25)]"><Hand className="mx-auto h-10 w-10 text-[rgb(34,255,225)]" /><h2 className="mt-4 text-2xl font-semibold text-white">Enter Handspace</h2><p className="mt-2 text-sm text-white/65">Allow camera access, then raise your index and middle fingers together and hold to summon the radial menu.</p>{error && <p className="mt-3 text-sm text-[rgb(255,90,130)]">{error}</p>}<button onClick={() => { sfx.select(); void start(); }} disabled={status === "loading"} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[rgb(34,255,225)] px-6 py-3 font-mono text-xs tracking-[0.25em] text-black uppercase transition hover:shadow-[0_0_30px_rgba(34,255,225,0.7)] disabled:opacity-50"><Radio className="h-4 w-4" />{status === "loading" ? "initialising…" : status === "error" ? "retry" : "activate"}</button></div></div>}

      {status === "ready" && <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 text-center"><div className="mx-auto h-1 w-44 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[rgb(34,255,225)] shadow-[0_0_12px_rgba(34,255,225,0.8)] transition-[width] duration-75" style={{ width: `${Math.round(swipeProgress * 100)}%` }} /></div><p className="mt-2 font-mono text-[9px] tracking-[0.22em] text-white/45 uppercase">raise index + middle · hold to {menuOpen || socialOpen || signOpen ? "close" : "open"}</p>{(menuOpen || socialOpen) && <p className="mt-1 font-mono text-[8px] tracking-widest text-[rgb(34,255,225)]/60 uppercase">point · pinch to select · pinch + drag to scroll</p>}{signOpen && <p className="mt-1 font-mono text-[8px] tracking-widest text-[rgb(255,90,210)]/70 uppercase">ASL · sign letters one at a time · FB opens Holo Social</p>}{fxEnabled && <p className="mt-1 font-mono text-[8px] tracking-widest text-[rgb(255,90,210)]/70 uppercase">FX AUTO · hold an iconic pose for the anime pause</p>}</div>}

      {menuOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="relative h-[min(70vw,500px)] w-[min(70vw,500px)] max-h-[64vh] max-w-[64vh]">
            <div className="absolute inset-[12%] rounded-full border border-[rgba(34,255,225,0.22)]" />
            <div className="absolute inset-[22%] rounded-full border border-[rgba(34,255,225,0.14)] bg-[radial-gradient(circle,rgba(34,255,225,0.07),rgba(2,8,18,0.1)_58%,transparent_72%)] shadow-[0_0_70px_rgba(34,255,225,0.12)]" />
            <div className="absolute inset-[33%] rounded-full border border-[rgba(255,90,210,0.34)] bg-[rgba(3,13,25,0.78)] shadow-[0_0_45px_rgba(255,90,210,0.14)] backdrop-blur-xl" />

            {MENU_ITEMS.map(({ id, label, desc, Icon, angle }) => {
              const radians = (angle * Math.PI) / 180;
              const x = 50 + Math.cos(radians) * 34;
              const y = 50 + Math.sin(radians) * 34;
              const selected = active === id;
              const isHovered = hovered === id;
              return <button key={id} ref={setTarget(id)} onClick={() => activate(id)} aria-label={`${label}: ${desc}`} className={`pointer-events-auto absolute flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border transition-all duration-200 ${selected ? "scale-110 border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.18)] shadow-[0_0_38px_rgba(255,90,210,0.5)]" : isHovered ? "scale-110 border-[rgb(34,255,225)] bg-[rgba(34,255,225,0.16)] shadow-[0_0_38px_rgba(34,255,225,0.45)]" : "border-[rgba(34,255,225,0.34)] bg-[rgba(3,13,25,0.74)] shadow-[0_0_24px_rgba(34,255,225,0.12)]"}`} style={{ left: `${x}%`, top: `${y}%` }}><Icon className={`h-5 w-5 ${selected ? "text-[rgb(255,90,210)]" : "text-[rgb(34,255,225)]"}`} /><span className="mt-1 font-mono text-[9px] tracking-[0.18em] text-white uppercase">{label}</span><span className="mt-0.5 font-mono text-[6px] tracking-wider text-white/40 uppercase">{desc}</span></button>;
            })}

            <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[rgba(34,255,225,0.45)] bg-[rgba(3,13,25,0.84)] shadow-[0_0_50px_rgba(34,255,225,0.18)] backdrop-blur-xl">
              <Box className="h-6 w-6 text-[rgb(34,255,225)]" />
              <p className="mt-2 font-mono text-[9px] tracking-[0.26em] text-white uppercase">{active ? active : "HANDSPACE"}</p>
              <p className="mt-1 font-mono text-[6px] tracking-widest text-white/40 uppercase">PINCH TO SELECT · 2 FINGERS TO CLOSE</p>
            </div>
          </div>
        </div>
      )}

      {signOpen && <SignLanguagePanel recognized={recognizedSigns} currentLetter={fslLetter} handsRef={handsRef} onClose={closeSign} />}
      {socialOpen && <SocialARPanel registerTarget={setTarget} onClose={closeSocial} onActivate={activate} />}

      {(menuOpen || socialOpen) && pointer.active && <div className="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-1/2" style={{ left: pointer.x, top: pointer.y }}><div className={`h-12 w-12 rounded-full border-2 ${hovered ? "border-[rgb(255,90,210)] shadow-[0_0_24px_rgba(255,90,210,0.65)]" : "border-[rgb(34,255,225)] shadow-[0_0_20px_rgba(34,255,225,0.45)]"}`}><div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(34,255,225)]" /></div></div>}
    </div>
  );
}

function StatusPill({ label, on }: { label: string; on: boolean }) { return <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-2 font-mono text-[10px] tracking-widest text-white/70 uppercase backdrop-blur"><span className={`h-2 w-2 rounded-full ${on ? "bg-[rgb(34,255,225)] shadow-[0_0_10px_rgba(34,255,225,0.8)]" : "bg-white/30"}`} />{label}</span>; }
