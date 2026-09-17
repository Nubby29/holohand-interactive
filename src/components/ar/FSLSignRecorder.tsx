import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Download, Play, Square, Trash2, Upload } from "lucide-react";
import type { HandState, Landmark } from "./useHandTracking";

const STORAGE_KEY = "holohand-fsl-sign-dataset-v1";
const MAX_RECORDING_MS = 4000;
const SAMPLE_INTERVAL_MS = 50;

export type FSLRecordedFrame = {
  t: number;
  hands: Array<{
    handedness: string;
    landmarks: Array<[number, number, number]>;
  }>;
};

export type FSLRecordedSign = {
  id: string;
  label: string;
  createdAt: string;
  durationMs: number;
  frames: FSLRecordedFrame[];
};

export type FSLSignDataset = {
  schemaVersion: 1;
  app: "HoloHand";
  type: "FSL_DYNAMIC_SIGNS";
  signs: FSLRecordedSign[];
};

function loadDataset(): FSLSignDataset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schemaVersion: 1, app: "HoloHand", type: "FSL_DYNAMIC_SIGNS", signs: [] };
    const parsed = JSON.parse(raw) as FSLSignDataset;
    if (!Array.isArray(parsed.signs)) throw new Error("Invalid dataset");
    return { schemaVersion: 1, app: "HoloHand", type: "FSL_DYNAMIC_SIGNS", signs: parsed.signs };
  } catch {
    return { schemaVersion: 1, app: "HoloHand", type: "FSL_DYNAMIC_SIGNS", signs: [] };
  }
}

function saveDataset(dataset: FSLSignDataset) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
}

function normalizeHand(landmarks: Landmark[]) {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  if (!wrist || !middleMcp) return null;
  const scale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.0001;
  return landmarks.map((point) => [
    (point.x - wrist.x) / scale,
    (point.y - wrist.y) / scale,
    point.z / scale,
  ] as [number, number, number]);
}

export function FSLSignRecorder({ handsRef }: { handsRef: MutableRefObject<HandState> }) {
  const [label, setLabel] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dataset, setDataset] = useState<FSLSignDataset>(() => loadDataset());
  const [message, setMessage] = useState("Ready to record a dynamic sign.");
  const startedAtRef = useRef(0);
  const framesRef = useRef<FSLRecordedFrame[]>([]);
  const lastSampleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    return () => {
      recordingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const stopRecording = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRecording(false);

    const cleanLabel = label.trim().toUpperCase();
    const frames = framesRef.current;
    const durationMs = Math.max(0, Math.round(performance.now() - startedAtRef.current));
    if (!cleanLabel || frames.length < 5) {
      framesRef.current = [];
      setMessage("Recording discarded. Enter a sign name and record a little longer.");
      return;
    }

    const nextSign: FSLRecordedSign = {
      id: `${cleanLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      label: cleanLabel,
      createdAt: new Date().toISOString(),
      durationMs,
      frames,
    };
    const nextDataset = { ...dataset, signs: [...dataset.signs, nextSign] };
    setDataset(nextDataset);
    saveDataset(nextDataset);
    framesRef.current = [];
    setElapsed(0);
    setMessage(`Saved ${cleanLabel} · ${frames.length} frames. Record more examples for the same sign if needed.`);
  };

  const startRecording = () => {
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setMessage("Enter the FSL sign name first, for example CLOSE.");
      return;
    }
    if (recordingRef.current) return;

    framesRef.current = [];
    startedAtRef.current = performance.now();
    lastSampleRef.current = 0;
    setElapsed(0);
    setMessage(`Recording ${cleanLabel.toUpperCase()}… perform the sign naturally.`);
    recordingRef.current = true;
    setRecording(true);

    const loop = (now: number) => {
      if (!recordingRef.current) return;
      const elapsedNow = now - startedAtRef.current;
      setElapsed(Math.min(MAX_RECORDING_MS, elapsedNow));

      if (elapsedNow >= MAX_RECORDING_MS) {
        stopRecording();
        return;
      }

      if (now - lastSampleRef.current >= SAMPLE_INTERVAL_MS) {
        lastSampleRef.current = now;
        const state = handsRef.current;
        const hands = state.landmarks
          .map((landmarks, index) => {
            const normalized = normalizeHand(landmarks);
            if (!normalized) return null;
            return {
              handedness: state.handedness[index] ?? "",
              landmarks: normalized,
            };
          })
          .filter((hand): hand is NonNullable<typeof hand> => Boolean(hand));

        if (hands.length) framesRef.current.push({ t: Math.round(elapsedNow), hands });
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  const deleteSign = (id: string) => {
    const nextDataset = { ...dataset, signs: dataset.signs.filter((sign) => sign.id !== id) };
    setDataset(nextDataset);
    saveDataset(nextDataset);
    setMessage("Saved example removed from this browser.");
  };

  const downloadDataset = () => {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "holohand-fsl-signs.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Dataset exported. Commit the JSON to GitHub when you want it included in the project.");
  };

  const importDataset = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const imported = JSON.parse(await file.text()) as FSLSignDataset;
        if (imported.schemaVersion !== 1 || !Array.isArray(imported.signs)) throw new Error("Unsupported dataset");
        setDataset(imported);
        saveDataset(imported);
        setMessage(`Imported ${imported.signs.length} saved example${imported.signs.length === 1 ? "" : "s"}.`);
      } catch {
        setMessage("Could not import that dataset JSON.");
      }
    };
    input.click();
  };

  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] tracking-[0.22em] text-[rgb(255,90,210)] uppercase">SIGN TRAINER</p>
          <p className="mt-1 text-xs text-white/45">Record landmark sequences for signs you want HoloHand to learn.</p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[8px] tracking-widest text-white/45 uppercase">{dataset.signs.length} saved</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input value={label} onChange={(event) => setLabel(event.target.value)} disabled={recording} placeholder="Sign name (e.g. CLOSE)" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 font-mono text-xs tracking-wider text-white outline-none placeholder:text-white/25 focus:border-[rgba(34,255,225,0.45)]" />
        {!recording ? (
          <button onClick={startRecording} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(34,255,225,0.35)] bg-[rgba(34,255,225,0.08)] px-4 py-2.5 font-mono text-[9px] tracking-widest text-[rgb(34,255,225)] uppercase transition hover:bg-[rgba(34,255,225,0.16)]"><Play className="h-3.5 w-3.5" />Record</button>
        ) : (
          <button onClick={stopRecording} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(255,90,130,0.4)] bg-[rgba(255,90,130,0.08)] px-4 py-2.5 font-mono text-[9px] tracking-widest text-[rgb(255,90,130)] uppercase transition hover:bg-[rgba(255,90,130,0.15)]"><Square className="h-3.5 w-3.5" />Stop</button>
        )}
      </div>

      {recording && <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[rgb(255,90,210)] shadow-[0_0_12px_rgba(255,90,210,0.8)]" style={{ width: `${(elapsed / MAX_RECORDING_MS) * 100}%` }} /></div>}
      <p className="mt-2 font-mono text-[8px] leading-relaxed tracking-wider text-white/35 uppercase">{message}</p>

      {dataset.signs.length > 0 && (
        <div className="mt-4 max-h-28 space-y-2 overflow-y-auto pr-1">
          {dataset.signs.slice().reverse().map((sign) => (
            <div key={sign.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <div><p className="font-mono text-[10px] tracking-widest text-white">{sign.label}</p><p className="mt-0.5 font-mono text-[7px] text-white/35">{sign.frames.length} frames · {Math.round(sign.durationMs / 100) / 10}s</p></div>
              <button onClick={() => deleteSign(sign.id)} disabled={recording} className="rounded-lg p-2 text-white/30 transition hover:bg-white/5 hover:text-[rgb(255,90,130)]" aria-label={`Delete ${sign.label} recording`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={downloadDataset} disabled={!dataset.signs.length || recording} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-mono text-[8px] tracking-widest text-white/55 uppercase transition hover:border-white/20 hover:text-white disabled:opacity-30"><Download className="h-3.5 w-3.5" />Export for GitHub</button>
        <button onClick={importDataset} disabled={recording} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-mono text-[8px] tracking-widest text-white/55 uppercase transition hover:border-white/20 hover:text-white disabled:opacity-30"><Upload className="h-3.5 w-3.5" />Import dataset</button>
      </div>
    </div>
  );
}
