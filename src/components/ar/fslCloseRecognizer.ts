import { FSL_CLOSE_TEMPLATE, type FslCloseFrame } from "./fslCloseTemplate";

type LandmarkLike = { x: number; y: number; z: number };
export type FSLMotionFrame = { landmarks: LandmarkLike[][]; handedness: string[] };

const POINTS = [0, 4, 8, 12, 16, 20];
const TEMPLATE_LENGTH = FSL_CLOSE_TEMPLATE.length;

function normalizeHand(landmarks: LandmarkLike[]) {
  if (landmarks.length < 21) return null;
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  if (!wrist || !middleMcp) return null;
  const scale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.0001;
  return POINTS.map((index) => {
    const p = landmarks[index];
    return [(p.x - wrist.x) / scale, (p.y - wrist.y) / scale] as [number, number];
  });
}

function toFrame(frame: FSLMotionFrame): [number[][] | null, number[][] | null] {
  const rightIndex = frame.handedness.findIndex((side) => side === "Right");
  const leftIndex = frame.handedness.findIndex((side) => side === "Left");
  return [
    rightIndex >= 0 ? normalizeHand(frame.landmarks[rightIndex] ?? []) : null,
    leftIndex >= 0 ? normalizeHand(frame.landmarks[leftIndex] ?? []) : null,
  ];
}

function resample(frames: [number[][] | null, number[][] | null][], length: number) {
  if (frames.length === length) return frames;
  if (frames.length < 2) return frames;
  return Array.from({ length }, (_, index) => {
    const source = (index * (frames.length - 1)) / (length - 1);
    return frames[Math.round(source)]!;
  });
}

function handDistance(a: number[][] | null, b: number[][] | null) {
  if (!a && !b) return 0;
  // The reference CLOSE recording transitions from two hands to one hand.
  // Missing-hand frames are therefore penalized, but not as strongly as a bad pose.
  if (!a || !b) return 0.42;
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += Math.hypot(a[i]![0] - b[i]![0], a[i]![1] - b[i]![1]);
  }
  return total / a.length;
}

function frameDistance(a: [number[][] | null, number[][] | null], b: FslCloseFrame["hands"]) {
  return handDistance(a[0], b[0]) + handDistance(a[1], b[1]);
}

/**
 * Returns a CLOSE similarity score from 0..1 using the user's recorded
 * temporal landmark sequence as the reference. Higher means more similar.
 */
export function scoreCloseSequence(sequence: FSLMotionFrame[]) {
  if (sequence.length < 14) return 0;

  const candidate = resample(sequence.slice(-Math.min(sequence.length, 55)).map(toFrame), TEMPLATE_LENGTH);
  if (candidate.length !== TEMPLATE_LENGTH) return 0;

  let motion = 0;
  for (let i = 1; i < candidate.length; i += 1) {
    motion += handDistance(candidate[i - 1]![0], candidate[i]![0]) + handDistance(candidate[i - 1]![1], candidate[i]![1]);
  }
  if (motion < 1.2) return 0;

  const rows = TEMPLATE_LENGTH + 1;
  const cols = TEMPLATE_LENGTH + 1;
  const dp = Array.from({ length: rows }, () => new Float64Array(cols).fill(Number.POSITIVE_INFINITY));
  dp[0]![0] = 0;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = frameDistance(candidate[i - 1]!, FSL_CLOSE_TEMPLATE[j - 1]!.hands);
      dp[i]![j] = cost + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }

  const distance = dp[TEMPLATE_LENGTH]![TEMPLATE_LENGTH]! / (TEMPLATE_LENGTH * 2);
  return Math.max(0, Math.min(1, 1 - distance / 0.75));
}
