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
  minimized: boolean;
};

type Props = { pointer: Pointer; pinching: boolean; twoHandTransform: TwoHandTransform };

const INITIAL_WINDOWS: SpatialWindow[] = [
  { id: "dashboard", title: "SYSTEM STATUS", x: 27, y: 31, scale: 1, rotation: 0, z: 10, minimized: false },
  { id: "objects", title: "OBJECT REGISTRY", x: 70, y: 42, scale: 0.9, rotation: -3, z: 9, minimized: false },
  { id: "controls", title: "HOLOGRAM CONTROL", x: 45, y: 73, scale: 0.82, rotation: 2, z: 8, minimized: false },
];

export function SpatialUI({ pointer, pinching, twoHandTransform }: Props) {
  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const [nextZ, setNextZ] = useState(11);
  const [contextOpen, setContextOpen] = useState<string | null>(null);
  const [slider, setSlider] = useState(62);
  const [card, setCard] = useState("SYSTEM STATUS");
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const transformStart = useRef<{ id: string; distance: number; angle: number; scale: number; rotation: number } | null>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const bringToFront = (id: string) => {
    setNextZ(z => z + 1);
    setWindows(current => current.map(w => w.id === id ? { ...w, z: nextZ } : w));
  };

  useEffect(() => {
    if (!pointer.active || twoHandTransform.active) return;
    const candidates = windows
      .filter(w => !w.minimized)
      .sort((a, b) => b.z - a.z);
    const target = candidates.find(w => {
      const el = panelRefs.current[w.id];
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    });

    if (!drag.current && pinching && target) {
      const r = panelRefs.current[target.id]!.getBoundingClientRect();
      drag.current = { id: target.id, ox: pointer.x - (r.left + r.width / 2), oy: pointer.y - (r.top + r.height / 2) };
      bringToFront(target.id);
    } else if (drag.current && !pinching) {
      drag.current = null;
    }

    if (drag.current && pinching) {
      const { id, ox, oy } = drag.current;
      setWindows(current => current.map(w => w.id === id ? { ...w, x: pointer.x - ox, y: pointer.y - oy } : w));
    }
  }, [pointer, pinching, twoHandTransform.active, windows]);

  useEffect(() => {
    if (!twoHandTransform.active) {
      transformStart.current = null;
      return;
    }

    if (!transformStart.current) {
      const active = windows.filter(w => !w.minimized).sort((a, b) => b.z - a.z)[0];
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
    const deltaAngle = (() => {
      let delta = twoHandTransform.angle - start.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      return delta;
    })();

    setWindows(current => current.map(w => {
      if (w.id !== start.id) return w;
      return {
        ...w,
        scale: start.distance > 1 ? Math.max(0.6, Math.min(1.65, start.scale * twoHandTransform.distance / start.distance)) : w.scale,
        rotation: start.rotation + deltaAngle * 180 / Math.PI,
        x: twoHandTransform.centerX,
        y: twoHandTransform.centerY,
      };
    }));
  }, [twoHandTransform, windows]);

  const updateWindow = (id: string, patch: Partial<SpatialWindow>) => {
    setWindows(current => current.map(w => w.id === id ? { ...w, ...patch } : w));
  };

  const contextItems = (id: string) => [
    { label: "Pin to space", action: () => updateWindow(id, { z: nextZ }) },
    { label: "Duplicate window", action: () => duplicateWindow(id) },
    { label: "Minimize window", action: () => updateWindow(id, { minimized: true }) },
  ];

  const duplicateWindow = (id: string) => {
    const source = windows.find(w => w.id === id);
    if (!source) return;
    const copy: SpatialWindow = {
      ...source,
      id: `${source.id}-${Date.now()}`,
      title: `${source.title} COPY`,
      x: Math.min(88, source.x + 7),
      y: Math.min(84, source.y + 7),
      z: nextZ,
      rotation: source.rotation + 2,
      minimized: false,
    };
    setNextZ(z => z + 1);
    setWindows(current => [...current, copy]);
    setContextOpen(null);
  };

  const restoreWindow = (id: string) => updateWindow(id, { minimized: false, z: nextZ });

  const renderWindowBody = (window: SpatialWindow) => {
    if (window.id.startsWith("objects")) {
      return (
        <div className="mt-3 space-y-2">
          {["WOODEN PALLET", "SIBERIAN HUSKY", "METAL CANISTER"].map((item, i) => (
            <div key={item} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2"><Box className="h-4 w-4 text-[rgb(34,255,225)]" /><span className="font-mono text-[9px] tracking-widest text-white/70">{item}</span></div>
              <span className="font-mono text-[9px] text-[rgb(34,255,225)]">#{String(i + 1).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
      );
    }

    if (window.id.startsWith("controls")) {
      return (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[rgb(34,255,225)]" /><span className="font-mono text-[10px] tracking-widest text-white/70 uppercase">hologram intensity</span></div><span className="font-mono text-[10px] text-[rgb(34,255,225)]">{slider}%</span></div>
          <input aria-label="Hologram intensity" type="range" min="0" max="100" value={slider} onChange={e => setSlider(Number(e.target.value))} className="mt-3 w-full accent-[rgb(34,255,225)]" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["DEPTH", "GLOW"].map(label => <button key={label} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 font-mono text-[9px] tracking-widest text-white/60 hover:border-[rgba(34,255,225,0.4)]">{label}</button>)}
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[{ icon: BarChart3, value: "98.4%", label: "TRACKING" }, { icon: FileText, value: "12", label: "OBJECTS" }, { icon: Settings2, value: "READY", label: "CORE" }].map(({ icon: Icon, value, label }) => <button key={label} onClick={() => setCard(label)} className={`rounded-xl border p-3 text-left transition ${card === label ? "border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.1)]" : "border-white/10 bg-white/5 hover:border-[rgba(34,255,225,0.4)]"}`}><Icon className="h-4 w-4 text-[rgb(34,255,225)]" /><p className="mt-2 text-sm font-semibold">{value}</p><p className="font-mono text-[9px] tracking-widest text-white/45">{label}</p></button>)}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="font-mono text-[9px] tracking-widest text-white/45">ACTIVE CARD</span><span className="font-mono text-[10px] text-[rgb(255,90,210)]">{card}</span><ChevronDown className="h-3.5 w-3.5 text-white/35" /></div>
      </>
    );
  };

  const visibleWindows = windows.filter(w => !w.minimized).sort((a, b) => a.z - b.z);
  const minimizedWindows = windows.filter(w => w.minimized);

  return (
    <>
      {visibleWindows.map(window => (
        <div key={window.id} ref={el => { panelRefs.current[window.id] = el; }} className="absolute z-10 w-[min(390px,78vw)] rounded-2xl border border-[rgba(34,255,225,0.4)] bg-[rgba(3,13,25,0.58)] p-4 text-white shadow-[0_0_55px_rgba(34,255,225,0.16)] backdrop-blur-xl" style={{ left: `${window.x}%`, top: `${window.y}%`, zIndex: window.z, transform: `translate(-50%,-50%) rotate(${window.rotation}deg) scale(${window.scale})` }}>
          <div className="relative flex items-center justify-between border-b border-white/10 pb-3">
            <button onClick={() => bringToFront(window.id)} className="flex items-center gap-2 text-left"><Box className="h-4 w-4 text-[rgb(34,255,225)]" /><span className="font-mono text-[10px] tracking-[0.28em] text-[rgb(34,255,225)] uppercase">{window.title}</span></button>
            <div className="flex items-center gap-1">
              <button aria-label={`Context menu for ${window.title}`} onClick={() => setContextOpen(v => v === window.id ? null : window.id)} className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white"><MoreHorizontal className="h-4 w-4" /></button>
              <button aria-label={`Minimize ${window.title}`} onClick={() => updateWindow(window.id, { minimized: true })} className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white"><ChevronDown className="h-4 w-4" /></button>
              <button aria-label={`Close ${window.title}`} onClick={() => updateWindow(window.id, { minimized: true })} className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-[rgb(255,90,210)]"><X className="h-4 w-4" /></button>
            </div>
            {contextOpen === window.id && <div className="absolute right-4 top-14 z-30 w-44 rounded-xl border border-[rgba(34,255,225,0.35)] bg-[rgba(2,8,18,0.94)] p-1 shadow-[0_0_30px_rgba(34,255,225,0.2)]">{contextItems(window.id).map(item => <button key={item.label} onClick={item.action} className="block w-full rounded-lg px-3 py-2 text-left font-mono text-[10px] tracking-wider text-white/70 hover:bg-[rgba(34,255,225,0.12)] hover:text-white">{item.label}</button>)}</div>}
          </div>
          {renderWindowBody(window)}
          <p className="mt-3 text-center font-mono text-[8px] tracking-widest text-white/30 uppercase">pinch title bar to move · two-hand pinch to transform</p>
        </div>
      ))}

      {minimizedWindows.length > 0 && (
        <div className="absolute bottom-8 left-1/2 z-[80] flex max-w-[90vw] -translate-x-1/2 gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl">
          {minimizedWindows.map(window => <button key={window.id} onClick={() => restoreWindow(window.id)} className="rounded-xl border border-[rgba(34,255,225,0.25)] bg-[rgba(3,13,25,0.72)] px-3 py-2 font-mono text-[9px] tracking-widest text-[rgb(34,255,225)] uppercase hover:bg-[rgba(34,255,225,0.1)]">restore · {window.title}</button>)}
        </div>
      )}
    </>
  );
}
