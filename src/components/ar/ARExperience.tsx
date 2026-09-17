import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Crosshair,
  Hand,
  Layers,
  Radio,
  Settings2,
  Sparkles,
  Waves,
  X,
} from "lucide-react";
import { HandOverlay } from "./HandOverlay";
import { useHandTracking } from "./useHandTracking";
import { sfx } from "./sfx";

const MENU_ITEMS = [
  { id: "scan", label: "Spatial Scan", desc: "Map the room mesh", Icon: Radio },
  { id: "layers", label: "Holo Layers", desc: "Stack AR surfaces", Icon: Layers },
  { id: "fx", label: "Particle FX", desc: "Ambient light field", Icon: Sparkles },
  { id: "calib", label: "Calibrate", desc: "Re-centre tracking", Icon: Settings2 },
];

export default function ARExperience() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hud, setHud] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const handleSwipe = useCallback(() => {
    setMenuOpen((open) => {
      if (open) sfx.close();
      else sfx.open();
      return !open;
    });
    setFlash(true);
    window.setTimeout(() => setFlash(false), 700);
  }, []);

  const { videoRef, handsRef, status, error, handPresent, swipeProgress, pointer, pinchPulse, start } =
    useHandTracking(handleSwipe);

  const DWELL_MS = 750;
  const targetsRef = useRef<Map<string, HTMLElement | null>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);
  const [dwell, setDwell] = useState(0);
  const hoverSoundRef = useRef<string | null>(null);
  const dwellStartRef = useRef(0);

  const setTarget = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      targetsRef.current.set(id, el);
    },
    [],
  );

  const activate = useCallback((id: string) => {
    if (id === "close") {
      sfx.close();
      setMenuOpen(false);
      return;
    }
    sfx.select();
    setActive(id);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 500);
  }, []);

  // Hit-test the virtual pointer against the menu targets.
  useEffect(() => {
    if (!menuOpen || !pointer.active) {
      setHovered(null);
      hoverSoundRef.current = null;
      return;
    }
    let found: string | null = null;
    targetsRef.current.forEach((el, id) => {
      if (!el || found) return;
      const r = el.getBoundingClientRect();
      if (pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom)
        found = id;
    });
    setHovered(found);
    if (found && hoverSoundRef.current !== found) {
      hoverSoundRef.current = found;
      sfx.hover();
    }
    if (!found) hoverSoundRef.current = null;
  }, [pointer, menuOpen]);

  // Dwell-to-click: hold the pointer on a target for DWELL_MS.
  useEffect(() => {
    if (!hovered) {
      setDwell(0);
      return;
    }
    dwellStartRef.current = performance.now();
    let raf = 0;
    let done = false;
    const tick = () => {
      const p = Math.min(1, (performance.now() - dwellStartRef.current) / DWELL_MS);
      setDwell(p);
      if (p >= 1 && !done) {
        done = true;
        activate(hovered);
        setDwell(0);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hovered, activate]);

  // Pinch-to-click: instant selection of whatever is hovered.
  useEffect(() => {
    if (!pinchPulse || !menuOpen || !hovered) return;
    activate(hovered);
    setDwell(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinchPulse]);


  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(2,6,16,0.85)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(0deg,rgba(34,255,225,0.14)_0px,rgba(34,255,225,0.14)_1px,transparent_1px,transparent_4px)]" />

      <HandOverlay handsRef={handsRef} enabled={hud && status === "ready"} />

      {flash && (
        <div className="pointer-events-none absolute inset-0 animate-[pulse_0.6s_ease-out] bg-[rgba(34,255,225,0.12)]" />
      )}

      {/* Top HUD bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 p-5">
        <div>
          <h1 className="font-mono text-sm tracking-[0.35em] text-[rgb(34,255,225)] uppercase">
            Aurora // Handspace
          </h1>
          <p className="mt-1 font-mono text-[11px] tracking-widest text-white/60 uppercase">
            gesture interface v2.6
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill
            label={status === "ready" ? (handPresent ? "hand locked" : "scanning") : status}
            on={status === "ready" && handPresent}
          />
          <button
            onClick={() => {
              sfx.hover();
              setHud((v) => !v);
            }}
            className="rounded-full border border-[rgba(34,255,225,0.4)] bg-black/40 px-4 py-2 font-mono text-[11px] tracking-widest text-[rgb(34,255,225)] uppercase backdrop-blur transition hover:bg-[rgba(34,255,225,0.15)]"
          >
            HUD {hud ? "on" : "off"}
          </button>
        </div>
      </header>

      {/* Start / error gate */}
      {status !== "ready" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm">
          <div className="max-w-md rounded-2xl border border-[rgba(34,255,225,0.35)] bg-black/60 p-8 text-center shadow-[0_0_60px_rgba(34,255,225,0.25)]">
            <Hand className="mx-auto h-10 w-10 text-[rgb(34,255,225)]" />
            <h2 className="mt-4 text-2xl font-semibold text-white">Enter Handspace</h2>
            <p className="mt-2 text-sm text-white/65">
              Allow camera access, hold your palm up, then swipe your whole hand — or just your
              index finger — downward to summon the holographic menu.
            </p>
            {error && <p className="mt-3 text-sm text-[rgb(255,90,130)]">{error}</p>}
            <button
              onClick={() => {
                sfx.select();
                void start();
              }}
              disabled={status === "loading"}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[rgb(34,255,225)] px-6 py-3 font-mono text-xs tracking-[0.25em] text-black uppercase transition hover:shadow-[0_0_30px_rgba(34,255,225,0.7)] disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              {status === "loading" ? "initialising…" : status === "error" ? "retry" : "activate"}
            </button>
          </div>
        </div>
      )}

      {/* Gesture indicator */}
      {status === "ready" && (
        <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 text-center">
          <div className="mx-auto h-1.5 w-52 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[rgb(34,255,225)] shadow-[0_0_14px_rgba(34,255,225,0.9)] transition-[width] duration-75"
              style={{ width: `${Math.round(swipeProgress * 100)}%` }}
            />
          </div>
          <p className="mt-2 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.3em] text-white/70 uppercase">
            <Waves className="h-3.5 w-3.5 text-[rgb(255,90,210)]" />
            swipe down to {menuOpen ? "dismiss" : "summon"}
          </p>
        </div>
      )}

      {/* Holographic menu */}
      <div
        className={`absolute inset-x-0 top-24 z-20 mx-auto w-[min(92vw,720px)] transition-all duration-500 ${
          menuOpen
            ? "translate-y-0 scale-100 opacity-100 blur-0"
            : "pointer-events-none -translate-y-10 scale-95 opacity-0 blur-md"
        }`}
      >
        <div className="relative rounded-3xl border border-[rgba(34,255,225,0.45)] bg-[rgba(4,12,22,0.55)] p-6 backdrop-blur-xl shadow-[0_0_80px_rgba(34,255,225,0.25)]">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] tracking-[0.35em] text-[rgb(34,255,225)] uppercase">
              holo menu
            </p>
            <button
              onClick={() => {
                sfx.close();
                setMenuOpen(false);
              }}
              className="rounded-full border border-white/20 p-1.5 text-white/70 transition hover:border-[rgb(255,90,210)] hover:text-[rgb(255,90,210)]"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {MENU_ITEMS.map(({ id, label, desc, Icon }, i) => (
              <button
                key={id}
                onMouseEnter={() => sfx.hover()}
                onClick={() => {
                  sfx.select();
                  setActive(id);
                }}
                style={{ transitionDelay: menuOpen ? `${i * 70}ms` : "0ms" }}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300 ${
                  active === id
                    ? "border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.12)] shadow-[0_0_30px_rgba(255,90,210,0.35)]"
                    : "border-[rgba(34,255,225,0.3)] bg-white/5 hover:border-[rgb(34,255,225)] hover:bg-[rgba(34,255,225,0.1)]"
                }`}
              >
                <Icon className="h-5 w-5 text-[rgb(34,255,225)] transition group-hover:scale-110" />
                <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                <p className="mt-0.5 font-mono text-[11px] tracking-wider text-white/55">{desc}</p>
              </button>
            ))}
          </div>

          <p className="mt-5 font-mono text-[11px] tracking-widest text-white/45 uppercase">
            {active ? `module engaged · ${active}` : "awaiting selection"}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, on }: { label: string; on: boolean }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-2 font-mono text-[11px] tracking-widest text-white/75 uppercase backdrop-blur">
      <span
        className={`h-2 w-2 rounded-full ${on ? "bg-[rgb(34,255,225)] shadow-[0_0_10px_rgb(34,255,225)]" : "bg-[rgb(255,190,80)]"}`}
      />
      {label}
    </span>
  );
}
