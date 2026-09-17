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
 * Detect the user's recorded FSL CLOSE motion.
 *
 * The recording is not simply "hands finish together". Its distinctive motion
 * is a valley: the hands begin separated, move together to a tight minimum,
 * then separate again. This implementation therefore matches the temporal
 * distance shape instead of requiring a particular camera position or pose.
 */
export function scoreCloseSequence(sequence: FSLMotionFrame[]) {
  if (sequence.length < 12) return 0;

  const pairs = sequence
    .map(getPairSample)
    .filter((sample): sample is PairSample => Boolean(sample));
  if (pairs.length < 8) return 0;

  // The live hook keeps up to ~4.4 seconds, but the sign itself is about 1.6 s
  // while both hands are visible. Analyze the most recent 24 paired samples.
  const window = pairs.slice(-24);
  if (window.length < 8) return 0;

  const distances = window.map((sample) => sample.distance);
  const minDistance = Math.min(...distances);
  const minIndex = distances.indexOf(minDistance);
  const first = distances[0]!;
  const last = distances[distances.length - 1]!;

  // The user's recording: ~0.60 -> ~0.16 -> ~0.63. Require a pronounced
  // inward movement and a pronounced outward movement after the minimum.
  const inwardAmount = first - minDistance;
  const outwardAmount = last - minDistance;
  const inwardScore = clamp01((inwardAmount - 0.18) / 0.28);
  const outwardScore = clamp01((outwardAmount - 0.16) / 0.28);

  // The minimum should occur after the beginning and before the end, not at an
  // edge caused by random tracking noise. The recording reaches its minimum
  // around the middle of the paired-hand sequence.
  const position = minIndex / Math.max(1, distances.length - 1);
  const positionScore = clamp01(1 - Math.abs(position - 0.55) / 0.40);

  // Measure how consistently the distance decreases before the minimum and
  // increases afterward. Small reversals are allowed because webcam landmarks
  // naturally jitter by a few pixels.
  const direction = (from: number, to: number, wantDecrease: boolean) => {
    let meaningful = 0;
    let correct = 0;
    for (let i = from + 1; i <= to; i += 1) {
      const delta = distances[i - 1]! - distances[i]!;
      if (Math.abs(delta) < 0.012) continue;
      meaningful += 1;
      if (wantDecrease ? delta > 0 : delta < 0) correct += 1;
    }
    return meaningful >= 2 ? correct / meaningful : 0;
  };

  const inwardDirection = direction(0, minIndex, true);
  const outwardDirection = direction(minIndex, distances.length - 1, false);
  const directionScore = (inwardDirection + outwardDirection) / 2;

  // Require the valley to be reasonably deep relative to the starting distance.
  const totalChange = first + last - 2 * minDistance;
  const shapeScore = clamp01((totalChange - 0.42) / 0.45);

  // Confirm actual hand movement rather than a distance change caused solely by
  // normalization/scale noise.
  let motionEnergy = 0;
  for (let i = 1; i < window.length; i += 1) {
    const previous = window[i - 1]!;
    const current = window[i]!;
    motionEnergy +=
      Math.hypot(current.right.centerX - previous.right.centerX, current.right.centerY - previous.right.centerY) +
      Math.hypot(current.left.centerX - previous.left.centerX, current.left.centerY - previous.left.centerY);
  }
  const motionScore = clamp01((motionEnergy - 0.08) / 0.55);

  const score =
    inwardScore * 0.24 +
    outwardScore * 0.24 +
    directionScore * 0.24 +
    shapeScore * 0.16 +
    positionScore * 0.06 +
    motionScore * 0.06;

  if (inwardAmount < 0.22) return 0;
  if (outwardAmount < 0.20) return 0;
  if (minIndex < 2 || minIndex > distances.length - 3) return 0;
  if (inwardDirection < 0.40 || outwardDirection < 0.40) return 0;
  if (motionEnergy < 0.08) return 0;

  return clamp01(score);
}
