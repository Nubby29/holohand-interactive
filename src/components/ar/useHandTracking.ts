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

  // Menu-open gesture state. The old downward swipe has been replaced with
  // an intentional two-finger hold: index + middle finger extended together.
  const twoFingerStartRef = useRef<number | null>(null);
  const twoFingerTriggeredRef = useRef(false);
  const lastTwoFingerTriggerRef = useRef(0);
  const TWO_FINGER_HOLD_MS = 650;
  const TWO_FINGER_COOLDOWN_MS = 1200;

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

          // Menu-open gesture: index + middle fingers raised while the other
          // fingers remain folded. It must be held briefly, which prevents
          // ordinary downward hand movement from opening the menu.
          const isFingerExtended = (tipIndex: number, pipIndex: number) => {
            const tip = hand[tipIndex];
            const pip = hand[pipIndex];
            if (!tip || !pip || !wrist) return false;
            const tipFromWrist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            const pipFromWrist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
            return tipFromWrist > pipFromWrist * 1.08;
          };

          const isFingerFolded = (tipIndex: number, pipIndex: number) => {
            const tip = hand[tipIndex];
            const pip = hand[pipIndex];
            if (!tip || !pip || !wrist) return false;
            const tipFromWrist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            const pipFromWrist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
            return tipFromWrist < pipFromWrist * 1.08;
          };

          const indexRaised = isFingerExtended(8, 6);
          const middleRaised = isFingerExtended(12, 10);
          const ringFolded = isFingerFolded(16, 14);
          const pinkyFolded = isFingerFolded(20, 18);
          const twoFingerGesture = indexRaised && middleRaised && ringFolded && pinkyFolded;

          if (twoFingerGesture) {
            if (twoFingerStartRef.current === null) {
              twoFingerStartRef.current = now;
              twoFingerTriggeredRef.current = false;
            }

            const progress = Math.min(
              1,
              (now - twoFingerStartRef.current) / TWO_FINGER_HOLD_MS,
            );
            setSwipeProgress(progress);

            if (
              progress >= 1 &&
              !twoFingerTriggeredRef.current &&
              now - lastTwoFingerTriggerRef.current > TWO_FINGER_COOLDOWN_MS
            ) {
              twoFingerTriggeredRef.current = true;
              lastTwoFingerTriggerRef.current = now;
              setSwipeProgress(0);
              swipeCbRef.current();
            }
          } else {
            twoFingerStartRef.current = null;
            twoFingerTriggeredRef.current = false;
            setSwipeProgress(0);
          }
        } else {
          twoFingerStartRef.current = null;
          twoFingerTriggeredRef.current = false;
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
