import { useCallback, useEffect, useRef, useState } from "react";

export type Landmark = { x: number; y: number; z: number };

export type HandState = {
  landmarks: Landmark[][];
  handedness: string[];
};

type Status = "idle" | "loading" | "ready" | "error";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export function useHandTracking(onSwipeDown: () => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handsRef = useRef<HandState>({ landmarks: [], handedness: [] });
  const rafRef = useRef<number | null>(null);
  const trackRef = useRef<Array<{ t: number; y: number }>>([]);
  const fingerTrackRef = useRef<Array<{ t: number; y: number }>>([]);
  const relTrackRef = useRef<Array<{ t: number; y: number }>>([]);
  const lastSwipeRef = useRef(0);
  const swipeCbRef = useRef(onSwipeDown);
  swipeCbRef.current = onSwipeDown;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [handPresent, setHandPresent] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [pointer, setPointer] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const [pinchPulse, setPinchPulse] = useState(0);
  const smoothRef = useRef<{ x: number; y: number } | null>(null);
  const pinchingRef = useRef(false);

  const start = useCallback(async () => {
    if (status === "loading" || status === "ready") return;
    setStatus("loading");
    setError(null);
    try {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      const video = videoRef.current;
      if (!video) throw new Error("Camera surface unavailable");
      video.srcObject = stream;
      await video.play();
      setStatus("ready");

      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        if (!video.videoWidth) return;
        const now = performance.now();
        let result;
        try {
          result = landmarker.detectForVideo(video, now);
        } catch {
          return;
        }
        const lms = (result?.landmarks ?? []) as Landmark[][];
        handsRef.current = {
          landmarks: lms,
          handedness: (result?.handedness ?? []).map((h) => h[0]?.categoryName ?? ""),
        };
        setHandPresent(lms.length > 0);

        if (lms.length > 0) {
          const hand = lms[0] ?? [];
          const palm = hand[9] ?? hand[0];
          const wrist = hand[0];
          const fingerTip = hand[8];
          const knuckle = hand[5];
          const thumbTip = hand[4];
          const midKnuckle = hand[9];

          // Virtual pointer: index fingertip mapped into viewport space.
          // The video is mirrored, so x is flipped. Exponential smoothing
          // takes the jitter out of the reticle without adding lag.
          if (fingerTip) {
            const tx = (1 - fingerTip.x) * window.innerWidth;
            const ty = fingerTip.y * window.innerHeight;
            const prev = smoothRef.current;
            const s = prev
              ? { x: prev.x + (tx - prev.x) * 0.35, y: prev.y + (ty - prev.y) * 0.35 }
              : { x: tx, y: ty };
            smoothRef.current = s;
            setPointer({ x: s.x, y: s.y, active: true });
          }

          // Pinch: thumb tip to index tip, normalised by hand size so the
          // distance from the camera doesn't matter.
          if (thumbTip && fingerTip && wrist && midKnuckle) {
            const handSize =
              Math.hypot(midKnuckle.x - wrist.x, midKnuckle.y - wrist.y) || 0.0001;
            const pinchDist =
              Math.hypot(thumbTip.x - fingerTip.x, thumbTip.y - fingerTip.y) / handSize;
            const isPinching = pinchDist < 0.45;
            if (isPinching && !pinchingRef.current) setPinchPulse((n) => n + 1);
            if (!isPinching && pinchDist > 0.6) pinchingRef.current = false;
            else if (isPinching) pinchingRef.current = true;
          }

          const windowMs = 700;
          const prune = (hist: Array<{ t: number; y: number }>) => {
            while (hist.length && now - (hist[0]?.t ?? now) > windowMs) hist.shift();
          };
          // Downward stroke distance measured from the HIGHEST point reached
          // in the window (peak) to the current position. This survives brief
          // holds/pauses mid-slide — pausing at the top doesn't reset progress,
          // and the stroke completes the moment the slide continues downward.
          const deltaY = (hist: Array<{ t: number; y: number }>) => {
            const last = hist[hist.length - 1];
            if (!last || hist.length < 2) return 0;
            let minY = Infinity;
            for (const p of hist) if (p.y < minY) minY = p.y;
            return last.y - minY;
          };

          // Whole-hand swipe: track palm (landmark 9, fallback 0).
          // 0.19 ≈ a modest, natural hand movement — no need to swing
          // the hand halfway across the screen.
          const PALM_THRESHOLD = 0.19;
          const palmHist = trackRef.current;
          if (palm) palmHist.push({ t: now, y: palm.y });
          prune(palmHist);
          const palmDy = deltaY(palmHist);

          // Pointer-finger flick: track index tip (landmark 8).
          // A natural seated finger slide only covers ~0.05–0.07 of screen
          // height, so the threshold is tuned far below the full-hand one.
          const FINGER_THRESHOLD = 0.065;
          const fingerHist = fingerTrackRef.current;
          if (fingerTip) fingerHist.push({ t: now, y: fingerTip.y });
          prune(fingerHist);
          const fingerDy = deltaY(fingerHist);

          // Relative finger movement: index tip's position measured against
          // the wrist / index knuckle. Sliding or curling the pointer finger
          // down increases this sharply even when the hand barely moves on
          // screen — catches the subtlest flicks.
          const REL_THRESHOLD = 0.055;
          const relHist = relTrackRef.current;
          if (fingerTip && wrist) {
            relHist.push({ t: now, y: fingerTip.y - wrist.y });
          } else if (fingerTip && knuckle) {
            relHist.push({ t: now, y: fingerTip.y - knuckle.y });
          }
          prune(relHist);
          const relDy = deltaY(relHist);

          const palmProgress = Math.max(0, Math.min(1, palmDy / PALM_THRESHOLD));
          const fingerProgress = Math.max(0, Math.min(1, fingerDy / FINGER_THRESHOLD));
          const relProgress = Math.max(0, Math.min(1, relDy / REL_THRESHOLD));

          setSwipeProgress(Math.max(palmProgress, fingerProgress, relProgress));
          if (
            (palmDy > PALM_THRESHOLD || fingerDy > FINGER_THRESHOLD || relDy > REL_THRESHOLD) &&
            now - lastSwipeRef.current > 900
          ) {
            lastSwipeRef.current = now;
            palmHist.length = 0;
            fingerHist.length = 0;
            relHist.length = 0;
            setSwipeProgress(0);
            swipeCbRef.current();
          }
        } else {
          trackRef.current.length = 0;
          fingerTrackRef.current.length = 0;
          relTrackRef.current.length = 0;
          setSwipeProgress(0);
          smoothRef.current = null;
          pinchingRef.current = false;
          setPointer((p) => (p.active ? { ...p, active: false } : p));
        }
      };
      loop();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not start the camera");
    }
  }, [status]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const v = videoRef.current;
      const s = v?.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    videoRef,
    handsRef,
    status,
    error,
    handPresent,
    swipeProgress,
    pointer,
    pinchPulse,
    start,
  };
}
