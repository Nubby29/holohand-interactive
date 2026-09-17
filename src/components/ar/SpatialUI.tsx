import { useEffect, useRef, useState } from "react";
import { BarChart3, Box, ChevronDown, FileText, MoreHorizontal, Settings2, SlidersHorizontal, X } from "lucide-react";
import type { TwoHandTransform } from "./useHandTracking";

type Pointer = { x: number; y: number; active: boolean };

type Props = { pointer: Pointer; pinching: boolean; twoHandTransform: TwoHandTransform };

export function SpatialUI({ pointer, pinching, twoHandTransform }: Props) {
  const [windowOpen, setWindowOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(false);
  const [slider, setSlider] = useState(62);
  const [card, setCard] = useState("SYSTEM STATUS");
  const [windowPos, setWindowPos] = useState({ x: 72, y: 170 });
  const [windowScale, setWindowScale] = useState(1);
  const [windowRotation, setWindowRotation] = useState(0);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const transformStart = useRef<{ distance: number; angle: number; scale: number; rotation: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!windowOpen || !pointer.active || !panelRef.current || twoHandTransform.active) return;
    const r = panelRef.current.getBoundingClientRect();
    const over = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    if (!dragging.current && pinching && over) {
      dragging.current = true;
      offset.current = { x: pointer.x - (r.left + r.width / 2), y: pointer.y - (r.top + r.height / 2) };
    } else if (dragging.current && !pinching) {
      dragging.current = false;
    }
    if (dragging.current && pinching) {
      setWindowPos({ x: pointer.x - offset.current.x, y: pointer.y - offset.current.y });
    }
  }, [pointer, pinching, twoHandTransform.active, windowOpen]);

  useEffect(() => {
    if (!twoHandTransform.active) {
      transformStart.current = null;
      return;
    }
    if (!transformStart.current) {
      transformStart.current = { distance: twoHandTransform.distance, angle: twoHandTransform.angle, scale: windowScale, rotation: windowRotation };
      return;
    }
    const start = transformStart.current;
    if (start.distance > 1) setWindowScale(Math.max(0.7, Math.min(1.7, start.scale * twoHandTransform.distance / start.distance)));
    let delta = twoHandTransform.angle - start.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    setWindowRotation(start.rotation + delta * 180 / Math.PI);
    setWindowPos({ x: twoHandTransform.centerX, y: twoHandTransform.centerY });
  }, [twoHandTransform]);

  const contextItems = ["Pin to space", "Duplicate card", "Minimize window"];

  if (!windowOpen) {
    return (
      <button onClick={() => setWindowOpen(true)} className="absolute left-8 top-40 z-10 rounded-xl border border-[rgba(34,255,225,0.35)] bg-black/50 px-4 py-3 font-mono text-[10px] tracking-widest text-[rgb(34,255,225)] backdrop-blur-xl uppercase">
        restore spatial window
      </button>
    );
  }

  return (
    <>
      <div ref={panelRef} className="absolute z-10 w-[min(430px,82vw)] rounded-2xl border border-[rgba(34,255,225,0.4)] bg-[rgba(3,13,25,0.58)] p-4 text-white shadow-[0_0_55px_rgba(34,255,225,0.16)] backdrop-blur-xl" style={{ left: windowPos.x, top: windowPos.y, transform: `translate(-50%,-50%) rotate(${windowRotation}deg) scale(${windowScale})` }}>
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2"><Box className="h-4 w-4 text-[rgb(34,255,225)]" /><span className="font-mono text-[10px] tracking-[0.28em] text-[rgb(34,255,225)] uppercase">spatial window</span></div>
          <div className="flex items-center gap-1">
            <button onClick={() => setContextOpen(v => !v)} className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white"><MoreHorizontal className="h-4 w-4" /></button>
            <button onClick={() => setWindowOpen(false)} className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-[rgb(255,90,210)]"><X className="h-4 w-4" /></button>
          </div>
          {contextOpen && <div className="absolute right-4 top-14 z-30 w-44 rounded-xl border border-[rgba(34,255,225,0.35)] bg-[rgba(2,8,18,0.94)] p-1 shadow-[0_0_30px_rgba(34,255,225,0.2)]">{contextItems.map(item => <button key={item} onClick={() => setContextOpen(false)} className="block w-full rounded-lg px-3 py-2 text-left font-mono text-[10px] tracking-wider text-white/70 hover:bg-[rgba(34,255,225,0.12)] hover:text-white">{item}</button>)}</div>}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[{ icon: BarChart3, value: "98.4%", label: "TRACKING" }, { icon: FileText, value: "12", label: "OBJECTS" }, { icon: Settings2, value: "READY", label: "CORE" }].map(({ icon: Icon, value, label }) => <button key={label} onClick={() => setCard(label)} className={`rounded-xl border p-3 text-left transition ${card === label ? "border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.1)]" : "border-white/10 bg-white/5 hover:border-[rgba(34,255,225,0.4)]"}`}><Icon className="h-4 w-4 text-[rgb(34,255,225)]" /><p className="mt-2 text-sm font-semibold">{value}</p><p className="font-mono text-[9px] tracking-widest text-white/45">{label}</p></button>)}
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[rgb(34,255,225)]" /><span className="font-mono text-[10px] tracking-widest text-white/70 uppercase">hologram intensity</span></div><span className="font-mono text-[10px] text-[rgb(34,255,225)]">{slider}%</span></div>
          <input aria-label="Hologram intensity" type="range" min="0" max="100" value={slider} onChange={e => setSlider(Number(e.target.value))} className="mt-3 w-full accent-[rgb(34,255,225)]" />
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="font-mono text-[9px] tracking-widest text-white/45">ACTIVE CARD</span><span className="font-mono text-[10px] text-[rgb(255,90,210)]">{card}</span><ChevronDown className="h-3.5 w-3.5 text-white/35" /></div>
        <p className="mt-3 text-center font-mono text-[9px] tracking-widest text-white/35 uppercase">pinch title bar to move · two-hand pinch to rotate + scale</p>
      </div>
    </>
  );
}
