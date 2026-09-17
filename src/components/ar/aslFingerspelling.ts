import type { Landmark } from "./useHandTracking";

export type ASLLetter = string | null;

export type ASLClassification = {
  letter: ASLLetter;
  confidence: number;
  reason: string;
};

type Features = {
  wrist: Landmark;
  tips: Landmark[];
  pips: Landmark[];
  mcps: Landmark[];
  extended: boolean[];
  folded: boolean[];
  handSize: number;
  thumbOpen: boolean;
  thumbIndex: number;
  thumbMiddle: number;
  indexMiddle: number;
  indexDirection: { x: number; y: number };
};

const d = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

function buildFeatures(hand: Landmark[]): Features | null {
  const wrist = hand[0];
  const thumbTip = hand[4];
  const indexMcp = hand[5];
  const indexPip = hand[6];
  const indexTip = hand[8];
  const middleMcp = hand[9];
  const middlePip = hand[10];
  const middleTip = hand[12];
  const ringMcp = hand[13];
  const ringPip = hand[14];
  const ringTip = hand[16];
  const pinkyMcp = hand[17];
  const pinkyPip = hand[18];
  const pinkyTip = hand[20];

  if (!wrist || !thumbTip || !indexMcp || !indexPip || !indexTip || !middleMcp || !middlePip || !middleTip || !ringMcp || !ringPip || !ringTip || !pinkyMcp || !pinkyPip || !pinkyTip) return null;

  const handSize = d(wrist, middleMcp) || 0.0001;
  const tips = [indexTip, middleTip, ringTip, pinkyTip];
  const pips = [indexPip, middlePip, ringPip, pinkyPip];
  const mcps = [indexMcp, middleMcp, ringMcp, pinkyMcp];
  const extended = tips.map((tip, i) => d(tip, wrist) > d(pips[i], wrist) * 1.08);
  const folded = tips.map((tip, i) => d(tip, wrist) < d(pips[i], wrist) * 1.10);
  const thumbIndex = d(thumbTip, indexTip) / handSize;
  const thumbMiddle = d(thumbTip, middleTip) / handSize;
  const indexMiddle = d(indexTip, middleTip) / handSize;
  const thumbOpen = d(thumbTip, wrist) > d(indexMcp, wrist) * 1.08;

  return {
    wrist,
    tips,
    pips,
    mcps,
    extended,
    folded,
    handSize,
    thumbOpen,
    thumbIndex,
    thumbMiddle,
    indexMiddle,
    indexDirection: { x: indexTip.x - indexMcp.x, y: indexTip.y - indexMcp.y },
  };
}

const count = (items: boolean[]) => items.filter(Boolean).length;
const near = (value: number, target: number, tolerance: number) => Math.max(0, 1 - Math.abs(value - target) / tolerance);

/**
 * Experimental static ASL fingerspelling classifier.
 * It intentionally reports a confidence rather than pretending that landmark
 * geometry alone can perfectly distinguish every ASL letter. J and Z require
 * motion, and several letters have subtle orientation differences; those are
 * handled as low-confidence/unknown until temporal training is added.
 */
export function classifyASL(hand: Landmark[]): ASLClassification {
  const f = buildFeatures(hand);
  if (!f) return { letter: null, confidence: 0, reason: "insufficient landmarks" };

  const [i, m, r, p] = f.extended;
  const [ifold, mfold, rfold, pfold] = f.folded;
  const extendedCount = count(f.extended);
  const foldedCount = count(f.folded);

  // Clear, high-separation handshapes first.
  if (i && m && r && p && !f.thumbOpen) {
    return { letter: "B", confidence: 0.90, reason: "four extended fingers, thumb folded" };
  }

  if (i && m && r && p && f.thumbOpen && f.thumbIndex > 0.85) {
    return { letter: "W", confidence: 0.84, reason: "three adjacent fingers plus pinky extended" };
  }

  if (i && m && !r && !p && f.indexMiddle < 0.22 && !f.thumbOpen) {
    return { letter: "U", confidence: 0.84, reason: "index and middle together" };
  }

  if (i && m && !r && !p && f.indexMiddle > 0.25 && !f.thumbOpen) {
    return { letter: "V", confidence: 0.87, reason: "index and middle separated" };
  }

  if (i && !m && !r && !p && f.thumbOpen && f.thumbIndex < 0.62) {
    return { letter: "L", confidence: 0.91, reason: "index and thumb extended" };
  }

  if (!i && !m && !r && p && !f.thumbOpen) {
    return { letter: "I", confidence: 0.89, reason: "pinky extended" };
  }

  if (!i && !m && !r && p && f.thumbOpen) {
    return { letter: "Y", confidence: 0.90, reason: "thumb and pinky extended" };
  }

  if (i && !m && !r && !p && !f.thumbOpen) {
    return { letter: "D", confidence: 0.80, reason: "index extended, remaining fingers folded" };
  }

  if (i && !m && !r && !p && f.thumbOpen) {
    const horizontal = Math.abs(f.indexDirection.x) > Math.abs(f.indexDirection.y) * 0.75;
    return { letter: horizontal ? "G" : "L", confidence: horizontal ? 0.76 : 0.72, reason: horizontal ? "index and thumb form a horizontal handshape" : "index and thumb extended" };
  }

  if (i && m && !r && !p && f.thumbOpen) {
    const downward = f.indexDirection.y > Math.abs(f.indexDirection.x) * 0.65;
    return { letter: downward ? "P" : "K", confidence: downward ? 0.70 : 0.73, reason: downward or upright K-family handshape" };
  }

  // F / O / C family.
  if (f.thumbIndex < 0.38 && m && r && p) {
    return { letter: "F", confidence: 0.94, reason: "thumb and index contact with three fingers extended" };
  }

  if (f.thumbIndex < 0.38 && foldedCount >= 3) {
    return { letter: "O", confidence: 0.90, reason: "thumb and index contact with curled fingers" };
  }

  if (extendedCount === 0 && f.thumbIndex > 0.40 && f.thumbIndex < 0.95) {
    const thumbAcrossTips = f.thumbMiddle < 0.55;
    return { letter: thumbAcrossTips ? "E" : "A", confidence: thumbAcrossTips ? 0.68 : 0.70, reason: "closed hand family; thumb position distinguishes A/E approximately" };
  }

  if (i && m && !r && !p && f.indexMiddle < 0.24) {
    return { letter: "H", confidence: 0.68, reason: "index and middle together; orientation-sensitive H" };
  }

  if (i && m && !r && !p && f.indexMiddle > 0.24) {
    return { letter: "R", confidence: 0.56, reason: "index/middle pair; crossed R needs orientation refinement" };
  }

  if (extendedCount === 0 && f.thumbIndex < 0.52 && f.thumbMiddle < 0.70) {
    return { letter: "T", confidence: 0.62, reason: "closed hand with thumb between index/middle region" };
  }

  if (extendedCount === 0 && f.thumbIndex > 0.70 && f.thumbMiddle > 0.70) {
    return { letter: "S", confidence: 0.62, reason: "closed fist family" };
  }

  // C is intentionally conservative because it is defined by a curved opening.
  const palmWidth = d(f.mcps[0], f.mcps[3]) / f.handSize;
  const thumbIndexGap = f.thumbIndex;
  if (palmWidth > 0.35 && thumbIndexGap > 0.45 && thumbIndexGap < 1.25 && foldedCount >= 2) {
    return { letter: "C", confidence: 0.60, reason: "curved C-family opening" };
  }

  // M/N are visually close to other closed handshapes without a dedicated
  // orientation model, so leave them unknown rather than generating bad text.
  return { letter: null, confidence: 0, reason: "ambiguous ASL handshape" };
}

export function isConfidentASL(classification: ASLClassification) {
  return Boolean(classification.letter && classification.confidence >= 0.68);
}
