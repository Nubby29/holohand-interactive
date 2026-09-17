import { useEffect, useRef, useState } from "react";
import { BarChart3, Box, ChevronDown, FileText, MoreHorizontal, Settings2, SlidersHorizontal, X } from "lucide-react";
import type { TwoHandTransform } from "./useHandTracking";

type Pointer = { x: number; y: number; active: boolean };

type SpatialWindow = {
  id: string;
  title: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
};

type Props = { pointer: Pointer; pinching: boolean; twoHandTransform: TwoHandTransform };

const INITIAL_WINDOWS: SpatialWindow[] = [
  { id: "dashboard", title: "SYSTEM STATUS", x: 0.18, y: 0.28, scale: 0.82, rotation: 0, z: 10 },
  { id: "objects", title: "OBJECT REGISTRY", x: 0.82, y: 0.29, scale: 0.78, rotation: 0, z: 9 },
  { id: "controls", title: "HOLOGRAM CONTROL", x: 0.78, y: 0.70, scale: 0.72, rotation: 0, z: 8 },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function SpatialUI({ pointer, pinching, twoHandTransform }: Props) {
  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const [nextZ, setNextZ] = useState(11);
  const [contextOpen, setContextOpen] = useState<string | null>(null);
  const [focusedWindow, setFocusedWindow] = useState<string | null>(null);
  const [slider, setSlider] = useState(62);
  const [card, setCard] = useState("SYSTEM STATUS");
  const windowsRef = useRef(windows);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const headerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const transformStart = useRef<{ id: string; distance: number; angle: number; scale: number; rotation: number } | null>(null);

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  const bringToFront = (id: string) => {
    setNextZ(currentZ => {
      setWindows(current => current.map(w => w.id === id ? { ...w, z: currentZ } : w));
      return currentZ + 1;
    });
    setFocusedWindow(id);
  };

  const hitTestWindow = () => {
    const candidates = windowsRef.current.slice().sort((a, b) => b.z - a.z);
    return candidates.find(w => {
      const el = panelRefs.current[w.id];
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    }) ?? null;
  };

  useEffect(() => {
    if (!pointer.active) {
      setFocusedWindow(null);
      if (!pinching) drag.current = null;
      return;
    }

    const target = hitTestWindow();
    setFocusedWindow(current => current === target?.id ? current : target?.id ?? null);

    if (twoHandTransform.active) return;

    if (!drag.current && pinching && target) {
      const header = headerRefs.current[target.id];
      if (header) {
        const r = header.getBoundingClientRect();
        if (pointer.y >= r.top && pointer.y <= r.bottom) {
          drag.current = { id: target.id, ox: pointer.x - (r.left + r.width / 2), oy: pointer.y - (r.top + r.height / 2) };
          bringToFront(target.id);
        }
      }
    } else if (drag.current && !pinching) {
      drag.current = null;
    }

    if (drag.current && pinching) {
      const { id, ox, oy } = drag.current;
      setWindows(current => current.map(w => w.id === id ? {
        ...w,
        x: clamp((pointer.x - ox) / window.innerWidth, 0.12, 0.88),
        y: clamp((pointer.y - oy) / window.innerHeight, 0.18, 0.82),
      } : w));
    }
  }, [pointer, pinching, twoHandTransform.active]);

  useEffect(() => {
    if (!twoHandTransform.active) {
      transformStart.current = null;
      return;
    }

    const currentWindows = windowsRef.current;
    if (!transformStart.current) {
      const preferred = focusedWindow ? currentWindows.find(w => w.id === focusedWindow) : null;
      const active = preferred ?? currentWindows.slice().sort((a, b) => b.z - a.z)[0];
      if (!active) return;
      transformStart.current = {
        id: active.id,
        distance: twoHandTransform.distance,
        angle: twoHandTransform.angle,
        scale: active.scale,
        rotation: active.rotation,
      };
      bringToFront(active.id);
      return;
    }

    const start = transformStart.current;
    let deltaAngle = twoHandTransform.angle - start.angle;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    setWindows(current => current.map(w => w.id === start.id ? {
      ...w,
      scale: start.distance > 1 ? clamp(start.scale * twoHandTransform.distance / start.distance, 0.58, 1.35) : w.scale,
      rotation: start.rotation + deltaAngle * 180 / Math.PI,
      x: clamp(twoHandTransform.centerX / window.innerWidth, 0.12, 0.88),
      y: clamp(twoHandTransform.centerY / window.innerHeight, 0.18, 0.82),
    } : w));
  }, [twoHandTransform, focusedWindow]);

  const updateWindow = (id: string, patch: Partial<SpatialWindow>) => {
    setWindows(current => current.map(w => w.id === id ? { ...w, ...patch } : w));
  };

  const duplicateWindow = (id: string) => {
    const source = windowsRef.current.find(w => w.id === id);
    if (!source) return;
    setNextZ(currentZ => {
      const copy: SpatialWindow = {
        ...source,
        id: `${source.id}-${Date.now()}`,
        title: `${source.title} COPY`,
        x: clamp(source.x + 0.07, 0.12, 0.88),
        y: clamp(source.y + 0.07, 0.18, 0.82),
        z: currentZ,
        rotation: source.rotation,
      };
      setWindows(current => [...current, copy]);
      setFocusedWindow(copy.id);
      return currentZ + 1;
    });
    setContextOpen(null);
  };

  const minimizeWindow = (id: string) => {
    setContextOpen(null);
    setWindows(current => current.filter(w => w.id !== id));
    if (focusedWindow === id) setFocusedWindow(null);
  };

  const renderWindowBody = (item: SpatialWindow) => {
    if (item.id.startsWith("objects")) {
      return (
        <div className="mt-2.5 space-y-1.5">
          {["WOODEN PALLET", "SIBERIAN HUSKY", "METAL CANISTER"].map((object, i) => (
            <div key={object} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
              <div className="flex min-w-0 items-center gap-2"><Box className="h-3.5 w-3.5 shrink-0 text-[rgb(34,255,225)]" /><span className="truncate font-mono text-[8px] tracking-widest text-white/65">{object}</span></div>
              <span className="font-mono text-[8px] text-[rgb(34,255,225)]">#{String(i + 1).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
      );
    }

    if (item.id.startsWith("controls")) {
      return (
        <div className="mt-2.5 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5 text-[rgb(34,255,225)]" /><span className="font-mono text-[8px] tracking-widest text-white/65 uppercase">intensity</span></div><span className="font-mono text-[9px] text-[rgb(34,255,225)]">{slider}%</span></div>
          <input aria-label="Hologram intensity" type="range" min="0" max="100" value={slider} onChange={e => setSlider(Number(e.target.value))} className="mt-2 w-full accent-[rgb(34,255,225)]" />
          <div className="mt-2 grid grid-cols-2 gap-1.5">{["DEPTH", "GLOW"].map(label => <button key={label} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 font-mono text-[8px] tracking-widest text-white/55 hover:border-[rgba(34,255,225,0.4)]">{label}</button>)}</div>
        </div>
      );
    }

    return (
      <>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {[{ icon: BarChart3, value: "98.4%", label: "TRACKING" }, { icon: FileText, value: "12", label: "OBJECTS" }, { icon: Settings2, value: "READY", label: "CORE" }].map(({ icon: Icon, value, label }) => <button key={label} onClick={() => setCard(label)} className={`rounded-lg border p-2 text-left transition ${card === label ? "border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.08)]" : "border-white/10 bg-white/[0.04] hover:border-[rgba(34,255,225,0.4)]"}`}><Icon className="h-3.5 w-3.5 text-[rgb(34,255,225)]" /><p className="mt-1 text-xs font-semibold">{value}</p><p className="font-mono text-[7px] tracking-widest text-white/40">{label}</p></button>)}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5"><span className="font-mono text-[7px] tracking-widest text-white/35">ACTIVE</span><span className="font-mono text-[8px] text-[rgb(255,90,210)]">{card}</span><ChevronDown className="h-3 w-3 text-white/25" /></div>
      </>
    );
  };

  const visibleWindows = windows.slice().sort((a, b) => a.z - b.z);

  return (
    <>
      {visibleWindows.map(item => {
        const focused = focusedWindow === item.id;
        return (
          <div key={item.id} ref={el => { panelRefs.current[item.id] = el; }} className={`absolute w-[min(310px,34vw)] rounded-xl border p-3 text-white backdrop-blur-xl transition-[opacity,box-shadow,border-color] duration-200 ${focused ? "border-[rgba(34,255,225,0.65)] opacity-100 shadow-[0_0_42px_rgba(34,255,225,0.16)]" : "border-[rgba(34,255,225,0.24)] opacity-80 shadow-[0_0_24px_rgba(34,255,225,0.08)]"} bg-[rgba(3,13,25,0.66)]`} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, zIndex: item.z, transform: `translate(-50%,-50%) rotate(${item.rotation}deg) scale(${item.scale})` }}>
            <div ref={el => { headerRefs.current[item.id] = el; }} className="relative flex h-8 items-center justify-between border-b border-white/10 pb-2">
              <button onClick={() => bringToFront(item.id)} className="flex min-w-0 items-center gap-2 text-left"><Box className="h-3.5 w-3.5 shrink-0 text-[rgb(34,255,225)]" /><span className="truncate font-mono text-[8px] tracking-[0.24em] text-[rgb(34,255,225)] uppercase">{item.title}</span></button>
              <div className="flex items-center gap-0.5">
                <button aria-label={`Context menu for ${item.title}`} onClick={() => { bringToFront(item.id); setContextOpen(v => v === item.id ? null : item.id); }} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                <button aria-label={`Minimize ${item.title}`} onClick={() => minimizeWindow(item.id)} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><ChevronDown className="h-3.5 w-3.5" /></button>
                <button aria-label={`Close ${item.title}`} onClick={() => minimizeWindow(item.id)} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-[rgb(255,90,210)]"><X className="h-3.5 w-3.5" /></button>
              </div>
              {contextOpen === item.id && <div className="absolute right-0 top-9 z-[100] w-40 rounded-lg border border-[rgba(34,255,225,0.3)] bg-[rgba(2,8,18,0.96)] p-1 shadow-[0_0_24px_rgba(34,255,225,0.15)]">
                <button onClick={() => { bringToFront(item.id); setContextOpen(null); }} className="block w-full rounded-md px-2.5 py-2 text-left font-mono text-[8px] tracking-wider text-white/65 hover:bg-white/10 hover:text-white">PIN TO SPACE</button>
                <button onClick={() => duplicateWindow(item.id)} className="block w-full rounded-md px-2.5 py-2 text-left font-mono text-[8px] tracking-wider text-white/65 hover:bg-white/10 hover:text-white">DUPLICATE WINDOW</button>
                <button onClick={() => minimizeWindow(item.id)} className="block w-full rounded-md px-2.5 py-2 text-left font-mono text-[8px] tracking-wider text-white/65 hover:bg-white/10 hover:text-white">REMOVE WINDOW</button>
              </div>}
            </div>
            {renderWindowBody(item)}
          </div>
        );
      })}

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-[7px] tracking-[0.18em] text-white/35 backdrop-blur-md uppercase">
        pinch title bar · two-hand pinch to transform
      </div>
    </>
  );
}
