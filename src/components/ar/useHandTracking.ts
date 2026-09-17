import { useCallback, useEffect, useRef, useState } from "react";
import { scoreCloseSequence, type FSLMotionFrame } from "./fslCloseRecognizer";

export type Landmark = { x: number; y: number; z: number };

export type HandState = {
  landmarks: Landmark[][];
  handedness: string[];
};

export type TwoHandTransform = {
  active: boolean;
  centerX: number;
  centerY: number;
  distance: number;
  angle: number;
};

type FSLLetter = "F" | "B" | null;
type Status = "idle" | "loading" | "ready" | "error";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

function classifyFslLetter(hand: Landmark[]): FSLLetter {
  const wrist = hand[0];
  const thumbTip = hand[4];
  const indexTip = hand[8];
  const indexPip = hand[6];
  const middleMcp = hand[9];
  const middleTip = hand[12];
  const middlePip = hand[10];
  const ringTip = hand[16];
  const ringPip = hand[14];
  const pinkyTip = hand[20];
  const pinkyPip = hand[18];
  if (!wrist || !thumbTip || !indexTip || !indexPip || !middleMcp || !middleTip || !middlePip || !ringTip || !ringPip || !pinkyTip || !pinkyPip) {
    return null;
  }

  const extended = (tip: Landmark, pip: Landmark) =>
    Math.hypot(tip.x - wrist.x, tip.y - wrist.y) > Math.hypot(pip.x - wrist.x, pip.y - wrist.y) * 1.08;

  const indexExtended = extended(indexTip, indexPip);
  const middleExtended = extended(middleTip, middlePip);
  const ringExtended = extended(ringTip, ringPip);
  const pinkyExtended = extended(pinkyTip, pinkyPip);
  const handSize = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.0001;
  const thumbIndexDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
  const thumbTouchesIndex = thumbIndexDistance / handSize < 0.42;

  // F: thumb and index meet while middle, ring and pinky remain extended.
  if (thumbTouchesIndex && middleExtended && ringExtended && pinkyExtended) return "F";

  // B: four fingers are extended while the thumb is folded across the palm.
  const thumbFolded =
    Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) <
    Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y) * 1.35;
  if (indexExtended && middleExtended && ringExtended && pinkyExtended && thumbFolded) return "B";

  return null;
}

export function useHandTracking(onTwoFingerHold: () => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handsRef = useRef<HandState>({ landmarks: [], handedness: [] });
  const rafRef = useRef<number | null>(null);
  const swipeCbRef = useRef(onTwoFingerHold);
  swipeCbRef.current = onTwoFingerHold;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [handPresent, setHandPresent] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [pointer, setPointer] = useState<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const [pinchPulse, setPinchPulse] = useState(0);
  const [pinching, setPinching] = useState(false);
  const [fslLetter, setFslLetter] = useState<FSLLetter>(null);
  const [twoHandTransform, setTwoHandTransform] = useState<TwoHandTransform>({ active: false, centerX: 0, centerY: 0, distance: 0, angle: 0 });
  const smoothRef = useRef<{ x: number; y: number } | null>(null);
  const pinchingRef = useRef(false);
  const fslCandidateRef = useRef<FSLLetter>(null);
  const fslCandidateSinceRef = useRef(0);

  const closeSequenceRef = useRef<FSLMotionFrame[]>([]);
  const lastCloseSampleRef = useRef(0);
  const closeTriggeredRef = useRef(false);
  const lastCloseDetectionRef = useRef(0);

  const twoFingerStartRef = useRef<number | null>(null);
  const twoFingerTriggeredRef = useRef(false);
  const lastTwoFingerTriggerRef = useRef(0);
  const TWO_FINGER_HOLD_MS = 650;
  const TWO_FINGER_COOLDOWN_MS = 1200;
  const FSL_STABLE_MS = 280;
  const CLOSE_SAMPLE_MS = 80;
  const CLOSE_MAX_FRAMES = 55;
  const CLOSE_THRESHOLD = 0.62;
  const CLOSE_COOLDOWN_MS = 2500;

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

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: false });
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
        const handedness = (result?.handedness ?? []).map((h) => h[0]?.categoryName ?? "");
        handsRef.current = { landmarks: lms, handedness };
        setHandPresent(lms.length > 0);

        // Dynamic FSL CLOSE recognition uses the user's recorded temporal landmark sequence.
        // The recorder sets this flag so a sign is never recognized while being recorded.
        if (now - lastCloseSampleRef.current >= CLOSE_SAMPLE_MS) {
          lastCloseSampleRef.current = now;
          const isRecording = document.body.dataset.fslRecording === "true";
          if (!isRecording && lms.length > 0) {
            closeSequenceRef.current.push({ landmarks: lms, handedness });
            if (closeSequenceRef.current.length > CLOSE_MAX_FRAMES) closeSequenceRef.current.shift();

            if (
              !closeTriggeredRef.current &&
              closeSequenceRef.current.length >= 24 &&
              now - lastCloseDetectionRef.current >= CLOSE_COOLDOWN_MS
            ) {
              const score = scoreCloseSequence(closeSequenceRef.current);
              if (score >= CLOSE_THRESHOLD) {
                closeTriggeredRef.current = true;
                lastCloseDetectionRef.current = now;
                closeSequenceRef.current = [];
                setSwipeProgress(0);
                swipeCbRef.current();
              }
            }
          } else if (isRecording) {
            closeSequenceRef.current = [];
            closeTriggeredRef.current = false;
          }
        }

        const getPinch = (hand: Landmark[]) => {
          const wrist = hand[0];
          const indexTip = hand[8];
          const thumbTip = hand[4];
          const middleMcp = hand[9];
          if (!wrist || !indexTip || !thumbTip || !middleMcp) return false;
          const handSize = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.0001;
          return Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y) / handSize < 0.45;
        };

        if (lms.length > 0) {
          const hand = lms[0] ?? [];
          const wrist = hand[0];
          const fingerTip = hand[8];
          const thumbTip = hand[4];
          const midKnuckle = hand[9];

          const detectedFslLetter = classifyFslLetter(hand);
          if (detectedFslLetter !== fslCandidateRef.current) {
            fslCandidateRef.current = detectedFslLetter;
            fslCandidateSinceRef.current = now;
          } else if (detectedFslLetter && now - fslCandidateSinceRef.current >= FSL_STABLE_MS) {
            setFslLetter((current) => (current === detectedFslLetter ? current : detectedFslLetter));
          } else if (!detectedFslLetter) {
            setFslLetter(null);
          }

          if (fingerTip) {
            const tx = (1 - fingerTip.x) * window.innerWidth;
            const ty = fingerTip.y * window.innerHeight;
            const prev = smoothRef.current;
            const s = prev ? { x: prev.x + (tx - prev.x) * 0.35, y: prev.y + (ty - prev.y) * 0.35 } : { x: tx, y: ty };
            smoothRef.current = s;
            setPointer({ x: s.x, y: s.y, active: true });
          }

          if (thumbTip && fingerTip && wrist && midKnuckle) {
            const handSize = Math.hypot(midKnuckle.x - wrist.x, midKnuckle.y - wrist.y) || 0.0001;
            const pinchDist = Math.hypot(thumbTip.x - fingerTip.x, thumbTip.y - fingerTip.y) / handSize;
            const isPinching = pinchDist < 0.45;
            setPinching(isPinching);
            if (isPinching && !pinchingRef.current) setPinchPulse((n) => n + 1);
            if (!isPinching && pinchDist > 0.6) pinchingRef.current = false;
            else if (isPinching) pinchingRef.current = true;
          }

          const isFingerExtended = (tipIndex: number, pipIndex: number) => {
            const tip = hand[tipIndex];
            const pip = hand[pipIndex];
            if (!tip || !pip || !wrist) return false;
            return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) > Math.hypot(pip.x - wrist.x, pip.y - wrist.y) * 1.08;
          };
          const isFingerFolded = (tipIndex: number, pipIndex: number) => {
            const tip = hand[tipIndex];
            const pip = hand[pipIndex];
            if (!tip || !pip || !wrist) return false;
            return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) < Math.hypot(pip.x - wrist.x, pip.y - wrist.y) * 1.08;
          };

          const twoFingerGesture = isFingerExtended(8, 6) && isFingerExtended(12, 10) && isFingerFolded(16, 14) && isFingerFolded(20, 18);
          if (twoFingerGesture) {
            if (twoFingerStartRef.current === null) {
              twoFingerStartRef.current = now;
              twoFingerTriggeredRef.current = false;
            }
            const progress = Math.min(1, (now - twoFingerStartRef.current) / TWO_FINGER_HOLD_MS);
            setSwipeProgress(progress);
            if (progress >= 1 && !twoFingerTriggeredRef.current && now - lastTwoFingerTriggerRef.current > TWO_FINGER_COOLDOWN_MS) {
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
          closeSequenceRef.current = [];
          closeTriggeredRef.current = false;
          setSwipeProgress(0);
          smoothRef.current = null;
          pinchingRef.current = false;
          fslCandidateRef.current = null;
          fslCandidateSinceRef.current = 0;
          setFslLetter(null);
          setPinching(false);
          setPointer((p) => (p.active ? { ...p, active: false } : p));
        }

        if (lms.length >= 2) {
          const first = lms[0] ?? [];
          const second = lms[1] ?? [];
          const firstIndex = first[8];
          const secondIndex = second[8];
          const bothPinching = getPinch(first) && getPinch(second);
          if (firstIndex && secondIndex && bothPinching) {
            const p1 = { x: (1 - firstIndex.x) * window.innerWidth, y: firstIndex.y * window.innerHeight };
            const p2 = { x: (1 - secondIndex.x) * window.innerWidth, y: secondIndex.y * window.innerHeight };
            setTwoHandTransform({ active: true, centerX: (p1.x + p2.x) / 2, centerY: (p1.y + p2.y) / 2, distance: Math.hypot(p2.x - p1.x, p2.y - p1.y), angle: Math.atan2(p2.y - p1.y, p2.x - p1.x) });
          } else {
            setTwoHandTransform((current) => (current.active ? { ...current, active: false } : current));
          }
        } else {
          setTwoHandTransform((current) => (current.active ? { ...current, active: false } : current));
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

  return { videoRef, handsRef, status, error, handPresent, swipeProgress, pointer, pinchPulse, pinching, fslLetter, twoHandTransform, start };
}
