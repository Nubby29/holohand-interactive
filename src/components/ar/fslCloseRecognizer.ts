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
      Math.hypot(indexMcp.x - wrist.x, indexMcp.y - wrist.y)) / 2,
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

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Detects the recorded CLOSE motion as a two-hand closing gesture.
 *
 * Unlike the previous template/DTW implementation, this deliberately does not
 * require the camera to reproduce the exact recorded trajectory. It recognizes
 * the robust motion characteristics of the recording: two hands are visible,
 * separated, move toward one another, and finish close together.
 */
export function scoreCloseSequence(sequence: FSLMotionFrame[]) {
  if (sequence.length < 10) return 0;

  // Work from recent raw frames and keep only frames where both hands are visible.
  // MediaPipe can briefly drop one hand while the hands approach each other.
  const pairs = sequence
    .map(getPairSample)
    .filter((sample): sample is PairSample => Boolean(sample));
  if (pairs.length < 8) return 0;

  // At 80 ms sampling, this is about 0.8–2.4 seconds. Using the most recent
  // window allows the detector to react while the gesture is still being made.
  const window = pairs.slice(-30);
  if (window.length < 8) return 0;

  const start = window[0]!;
  const end = window[window.length - 1]!;
  const minDistance = Math.min(...window.map((sample) => sample.distance));

  // The recording starts with clearly separated hands and ends with them close.
  const closingRatio = (start.distance - end.distance) / Math.max(start.distance, 0.0001);
  const separationScore = clamp01((start.distance - 1.15) / 1.15);
  const closeScore = clamp01((1.9 - end.distance) / 0.95);
  const ratioScore = clamp01((closingRatio - 0.18) / 0.42);

  // Check that the distance generally decreases rather than simply changing
  // because of unrelated hand movement. Allow some tracking noise/reversals.
  let decreasing = 0;
  let meaningful = 0;
  for (let i = 1; i < window.length; i += 1) {
    const delta = window[i - 1]!.distance - window[i]!.distance;
    if (Math.abs(delta) >= 0.012) {
      meaningful += 1;
      if (delta > 0) decreasing += 1;
    }
  }
  const directionScore = meaningful ? decreasing / meaningful : 0;

  // Confirm that the hands really moved, not merely that their normalized
  // distance happened to change because of scale noise.
  let motionEnergy = 0;
  for (let i = 1; i < window.length; i += 1) {
    const previous = window[i - 1]!;
    const current = window[i]!;
    motionEnergy +=
      Math.hypot(current.right.centerX - previous.right.centerX, current.right.centerY - previous.right.centerY) +
      Math.hypot(current.left.centerX - previous.left.centerX, current.left.centerY - previous.left.centerY);
  }
  const motionScore = clamp01((motionEnergy - 0.08) / 0.55);

  // Finishing close to the closest point is a useful discriminator.
  const finishScore = clamp01((minDistance + 0.22 - end.distance) / 0.55);

  // Keep the threshold intentionally reachable for webcam tracking.
  const score =
    separationScore * 0.18 +
    ratioScore * 0.28 +
    directionScore * 0.24 +
    closeScore * 0.16 +
    motionScore * 0.10 +
    finishScore * 0.04;

  if (start.distance < 1.15) return 0;
  if (closingRatio < 0.18) return 0;
  if (end.distance > 2.05) return 0;
  if (directionScore < 0.38) return 0;
  if (motionEnergy < 0.08) return 0;

  return clamp01(score);
}
