type LandmarkLike = { x: number; y: number; z: number };
export type FSLMotionFrame = { landmarks: LandmarkLike[][]; handedness: string[] };

type HandSample = { centerX: number; centerY: number; scale: number };
type PairSample = { right: HandSample; left: HandSample; distance: number };

function getHand(frame: FSLMotionFrame, side: "Right" | "Left"): LandmarkLike[] | null {
  const index = frame.handedness.findIndex((value) => value === side);
  return index >= 0 ? frame.landmarks[index] ?? null : null;
}

function sampleHand(landmarks: LandmarkLike[] | null): HandSample | null {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];
  const ringMcp = landmarks[13];
  const pinkyMcp = landmarks[17];
  if (!wrist || !indexMcp || !middleMcp || !ringMcp || !pinkyMcp) return null;

  const centerX = (wrist.x + indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 5;
  const centerY = (wrist.y + indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 5;
  const scale = Math.max(
    0.0001,
    (Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) +
      Math.hypot(indexMcp.x - wrist.x, indexMcp.y - wrist.y)) /
      2,
  );

  return { centerX, centerY, scale };
}

function getPairSample(frame: FSLMotionFrame): PairSample | null {
  const right = sampleHand(getHand(frame, "Right"));
  const left = sampleHand(getHand(frame, "Left"));
  if (!right || !left) return null;

  const scale = (right.scale + left.scale) / 2;
  const distance = Math.hypot(right.centerX - left.centerX, right.centerY - left.centerY) / scale;
  return { right, left, distance };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Scores the visual motion of the FSL CLOSE sign shown in the reference image:
 * two hands begin separated and move inward until they meet/are very close.
 *
 * This deliberately models the motion rather than matching a particular person's
 * hand pose, camera position, or exact frame timing. The score is 0..1.
 */
export function scoreCloseSequence(sequence: FSLMotionFrame[]) {
  if (sequence.length < 16) return 0;

  const pairs = sequence.map(getPairSample).filter((sample): sample is PairSample => Boolean(sample));
  if (pairs.length < 10) return 0;

  // Use a recent gesture window so several seconds of idle hand movement do not
  // dilute the closing motion. The sign normally completes within ~2 seconds.
  const window = pairs.slice(-Math.min(30, pairs.length));
  if (window.length < 10) return 0;

  const firstCount = Math.max(3, Math.floor(window.length * 0.25));
  const lastCount = Math.max(3, Math.floor(window.length * 0.25));
  const startDistance = median(window.slice(0, firstCount).map((sample) => sample.distance));
  const endDistance = median(window.slice(-lastCount).map((sample) => sample.distance));
  const minDistance = Math.min(...window.map((sample) => sample.distance));
  const maxDistance = Math.max(...window.map((sample) => sample.distance));

  // The defining feature: the two palms get substantially closer together.
  const closingRatio = (startDistance - endDistance) / Math.max(startDistance, 0.0001);
  const closingScore = clamp01((closingRatio - 0.28) / 0.42);

  // Prefer a clear open -> close trajectory instead of random hand movement.
  let decreasingSteps = 0;
  let meaningfulSteps = 0;
  for (let i = 1; i < window.length; i += 1) {
    const delta = window[i - 1]!.distance - window[i]!.distance;
    if (Math.abs(delta) > 0.018) {
      meaningfulSteps += 1;
      if (delta > 0) decreasingSteps += 1;
    }
  }
  const directionScore = meaningfulSteps > 0 ? decreasingSteps / meaningfulSteps : 0;

  // Require the hands to have actually started apart and ended close.
  const startSeparationScore = clamp01((startDistance - 1.35) / 1.05);
  const endTogetherScore = clamp01((1.55 - endDistance) / 0.75);

  // Measure real motion so a static two-hand pose cannot fire the command.
  let motionEnergy = 0;
  for (let i = 1; i < window.length; i += 1) {
    const previous = window[i - 1]!;
    const current = window[i]!;
    motionEnergy +=
      Math.hypot(current.right.centerX - previous.right.centerX, current.right.centerY - previous.right.centerY) +
      Math.hypot(current.left.centerX - previous.left.centerX, current.left.centerY - previous.left.centerY);
  }
  const motionScore = clamp01((motionEnergy - 0.18) / 0.75);

  // A close gesture should finish near its closest point rather than merely
  // passing through the center and opening again.
  const finishScore = clamp01((minDistance + 0.18 - endDistance) / 0.42);

  const score =
    closingScore * 0.34 +
    directionScore * 0.22 +
    startSeparationScore * 0.14 +
    endTogetherScore * 0.14 +
    motionScore * 0.10 +
    finishScore * 0.06;

  // Hard gates protect against false positives from ordinary two-hand motion.
  if (startDistance < 1.45 || closingRatio < 0.28 || endDistance > 1.7) return 0;
  if (directionScore < 0.48 || motionEnergy < 0.18) return 0;

  return clamp01(score);
}
