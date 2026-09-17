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
          const hist = trackRef.current;
          if (palm) hist.push({ t: now, y: palm.y });
          while (hist.length && now - (hist[0]?.t ?? now) > 700) hist.shift();
          const first = hist[0];
          const last = hist[hist.length - 1];
          const dy = hist.length > 1 && first && last ? last.y - first.y : 0;
          const p = Math.max(0, Math.min(1, dy / 0.33));
          setSwipeProgress(p);
          if (dy > 0.33 && now - lastSwipeRef.current > 1500) {
            lastSwipeRef.current = now;
            hist.length = 0;
            setSwipeProgress(0);
            swipeCbRef.current();
          }
        } else {
          trackRef.current.length = 0;
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
