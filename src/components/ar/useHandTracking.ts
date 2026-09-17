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
  const lastSwipeRef = useRef(0);
  const swipeCbRef = useRef(onSwipeDown);
  swipeCbRef.current = onSwipeDown;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [handPresent, setHandPresent] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);

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
          const fingerTip = hand[8];

          const windowMs = 700;
          const prune = (hist: Array<{ t: number; y: number }>) => {
            while (hist.length && now - (hist[0]?.t ?? now) > windowMs) hist.shift();
          };
          const deltaY = (hist: Array<{ t: number; y: number }>) => {
            const first = hist[0];
            const last = hist[hist.length - 1];
            return hist.length > 1 && first && last ? last.y - first.y : 0;
          };

          // Whole-hand swipe: track palm (landmark 9, fallback 0)
          const palmHist = trackRef.current;
          if (palm) palmHist.push({ t: now, y: palm.y });
          prune(palmHist);
          const palmDy = deltaY(palmHist);
          const palmProgress = Math.max(0, Math.min(1, palmDy / 0.33));

          // Pointer-finger flick: track index tip (landmark 8).
          // A finger flick covers less screen distance, so use a smaller threshold.
          const FINGER_THRESHOLD = 0.14;
          const fingerHist = fingerTrackRef.current;
          if (fingerTip) fingerHist.push({ t: now, y: fingerTip.y });
          prune(fingerHist);
          const fingerDy = deltaY(fingerHist);
          const fingerProgress = Math.max(0, Math.min(1, fingerDy / FINGER_THRESHOLD));

          setSwipeProgress(Math.max(palmProgress, fingerProgress));
          if ((palmDy > 0.33 || fingerDy > FINGER_THRESHOLD) && now - lastSwipeRef.current > 1500) {
            lastSwipeRef.current = now;
            palmHist.length = 0;
            fingerHist.length = 0;
            setSwipeProgress(0);
            swipeCbRef.current();
          }
        } else {
          trackRef.current.length = 0;
          fingerTrackRef.current.length = 0;
          setSwipeProgress(0);
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

  return { videoRef, handsRef, status, error, handPresent, swipeProgress, start };
}
