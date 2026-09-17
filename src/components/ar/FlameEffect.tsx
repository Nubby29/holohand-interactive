import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { HandState, Landmark } from "./useHandTracking";

type FlameEffectProps = {
  handsRef: MutableRefObject<HandState>;
  enabled: boolean;
};

type Vec = { x: number; y: number };
type EffectNode = { root: HTMLDivElement };

const dist = (a?: Landmark, b?: Landmark) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity);

function handScale(hand: Landmark[]) {
  return dist(hand[0], hand[9]) || 0.08;
}

function fingerExtended(hand: Landmark[], tip: number, pip: number) {
  return dist(hand[tip], hand[0]) > dist(hand[pip], hand[0]) * 1.08;
}

function openPalm(hand: Landmark[]) {
  return [8, 12, 16, 20].every((tip, i) => fingerExtended(hand, tip, [6, 10, 14, 18][i]));
}

function fist(hand: Landmark[]) {
  return [8, 12, 16, 20].every((tip, i) => !fingerExtended(hand, tip, [6, 10, 14, 18][i]));
}

function point(hand: Landmark[]) {
  return fingerExtended(hand, 8, 6) && !fingerExtended(hand, 12, 10) && !fingerExtended(hand, 16, 14) && !fingerExtended(hand, 20, 18);
}

function pinch(hand: Landmark[]) {
  const scale = handScale(hand);
  return dist(hand[4], hand[8]) / scale < 0.42;
}

function palmCenter(hand: Landmark[]): Vec {
  const points = [5, 9, 13, 17].map((i) => hand[i]).filter(Boolean);
  return points.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
}

function makeRoot(className = "") {
  const root = document.createElement("div");
  root.className = `pointer-events-none fixed z-[45] ${className}`;
  root.style.transform = "translate(-50%, -50%)";
  root.style.opacity = "0";
  root.style.willChange = "left,top,width,height,opacity,transform";
  return root;
}

function createFlame(): EffectNode {
  const root = makeRoot();
  root.style.height = "125px";
  root.style.width = "105px";
  root.style.transform = "translate(-50%, -92%)";
  root.style.filter = "drop-shadow(0 0 15px rgba(255,75,10,.72))";

  const aura = document.createElement("div");
  aura.className = "absolute inset-[-25%] rounded-full blur-2xl";
  aura.style.background = "radial-gradient(ellipse at center bottom,rgba(255,245,130,.45),rgba(255,80,0,.28) 38%,transparent 72%)";
  root.appendChild(aura);

  const core = document.createElement("div");
  core.className = "absolute bottom-[4%] left-1/2 h-[40%] w-[42%] -translate-x-1/2 rounded-[50%] blur-[4px]";
  core.style.background = "radial-gradient(ellipse at 50% 75%,#fff 0%,#ffe36b 25%,#ff7008 60%,transparent 100%)";
  core.style.animation = "hhFlameCore 360ms ease-in-out infinite alternate";
  root.appendChild(core);

  for (const [left, top, width, height, rotation, delay] of [
    ["34%", "3%", "32%", "87%", "-6deg", "0ms"],
    ["10%", "24%", "40%", "65%", "-20deg", "75ms"],
    ["50%", "17%", "38%", "70%", "15deg", "135ms"],
    ["29%", "37%", "45%", "55%", "2deg", "210ms"],
  ]) {
    const tongue = document.createElement("div");
    tongue.className = "absolute origin-bottom";
    tongue.style.left = left;
    tongue.style.top = top;
    tongue.style.width = width;
    tongue.style.height = height;
    tongue.style.transform = `rotate(${rotation})`;
    tongue.style.animation = "hhFlame 480ms ease-in-out infinite alternate";
    tongue.style.animationDelay = delay;
    tongue.style.background = "linear-gradient(to top,#ff2600,#ff7800 40%,#ffe35f 72%,#fff 100%)";
    tongue.style.clipPath = "polygon(50% 0%,68% 25%,61% 43%,89% 64%,72% 100%,28% 100%,10% 66%,36% 43%,29% 25%)";
    tongue.style.borderRadius = "48% 48% 32% 32%";
    root.appendChild(tongue);
  }
  return { root };
}

function createAura(): EffectNode {
  const root = makeRoot();
  root.style.width = "150px";
  root.style.height = "150px";
  root.style.borderRadius = "50%";
  root.style.border = "2px solid rgba(170,120,255,.72)";
  root.style.background = "radial-gradient(circle,rgba(255,255,255,.24),rgba(155,80,255,.2) 25%,rgba(80,20,255,.08) 55%,transparent 72%)";
  root.style.boxShadow = "0 0 25px rgba(160,90,255,.8), inset 0 0 35px rgba(210,150,255,.45)";
  root.style.filter = "blur(.2px)";
  root.style.animation = "hhAura 700ms ease-in-out infinite alternate";
  return { root };
}

function createBeam(): EffectNode {
  const root = makeRoot();
  root.style.height = "18px";
  root.style.width = "320px";
  root.style.transformOrigin = "0 50%";
  root.style.transform = "translate(0,-50%)";

  const core = document.createElement("div");
  core.className = "absolute inset-y-[25%] left-0 right-0 rounded-full";
  core.style.background = "linear-gradient(90deg,#fff,rgba(255,75,130,.98) 22%,rgba(255,40,190,.7) 65%,transparent)";
  core.style.boxShadow = "0 0 18px rgba(255,60,170,.95),0 0 45px rgba(255,30,180,.6)";
  root.appendChild(core);

  const halo = document.createElement("div");
  halo.className = "absolute inset-0 rounded-full blur-md";
  halo.style.background = "linear-gradient(90deg,rgba(255,255,255,.85),rgba(255,50,180,.4),transparent)";
  root.appendChild(halo);
  return { root };
}

function createOrb(): EffectNode {
  const root = makeRoot();
  root.style.width = "72px";
  root.style.height = "72px";
  root.style.borderRadius = "50%";
  root.style.background = "radial-gradient(circle at 35% 30%,#fff 0%,#8ffff6 12%,#20e9ff 36%,#176cff 62%,rgba(20,60,255,.05) 72%,transparent 76%)";
  root.style.boxShadow = "0 0 18px #36faff,0 0 55px rgba(35,160,255,.75)";
  root.style.animation = "hhOrb 650ms ease-in-out infinite alternate";
  return { root };
}

function createSphere(): EffectNode {
  const root = makeRoot();
  root.style.width = "150px";
  root.style.height = "150px";
  root.style.borderRadius = "50%";
  root.style.border = "1px solid rgba(90,240,255,.8)";
  root.style.background = "radial-gradient(circle,rgba(255,255,255,.35),rgba(70,220,255,.22) 18%,rgba(50,70,255,.12) 48%,transparent 70%)";
  root.style.boxShadow = "0 0 30px rgba(50,220,255,.8), inset 0 0 35px rgba(100,240,255,.5)";
  root.style.animation = "hhSphere 900ms linear infinite";
  return { root };
}

function createImpact(): EffectNode {
  const root = makeRoot();
  root.style.width = "90px";
  root.style.height = "90px";
  root.style.border = "4px solid rgba(255,255,255,.9)";
  root.style.borderRadius = "50%";
  root.style.boxShadow = "0 0 30px rgba(255,255,255,.9),0 0 80px rgba(40,220,255,.65)";
  root.style.animation = "hhImpact 520ms ease-out infinite";
  return { root };
}

function position(root: HTMLElement, point: Vec, size = 1) {
  root.style.left = `${(1 - point.x) * 100}%`;
  root.style.top = `${point.y * 100}%`;
  if (size !== 1) root.style.transform = `translate(-50%,-50%) scale(${size})`;
}

export function FlameEffect({ handsRef, enabled }: FlameEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<EffectNode[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes hhFlame { 0%{transform:translateY(3px) rotate(-5deg) scaleX(.9) scaleY(.94)} 50%{transform:translateY(-5px) rotate(4deg) scaleX(1.05) scaleY(1.03)} 100%{transform:translateY(-13px) rotate(-2deg) scaleX(.84) scaleY(1.08)} }
      @keyframes hhFlameCore { from{transform:translateX(-50%) scale(.9);opacity:.72} to{transform:translateX(-50%) scale(1.08);opacity:1} }
      @keyframes hhAura { from{transform:translate(-50%,-50%) scale(.84);opacity:.55} to{transform:translate(-50%,-50%) scale(1.15);opacity:1} }
      @keyframes hhOrb { from{transform:translate(-50%,-50%) scale(.86);filter:brightness(.9)} to{transform:translate(-50%,-50%) scale(1.15);filter:brightness(1.3)} }
      @keyframes hhSphere { from{transform:translate(-50%,-50%) rotate(0deg) scale(.92)} to{transform:translate(-50%,-50%) rotate(360deg) scale(1.06)} }
      @keyframes hhImpact { 0%{transform:translate(-50%,-50%) scale(.25);opacity:1} 100%{transform:translate(-50%,-50%) scale(2.2);opacity:0} }
    `;
    container.appendChild(style);

    // [0..1] flame, [2] fist aura, [3] point beam, [4] pinch orb, [5] two-hand sphere, [6] impact ring
    nodesRef.current = [createFlame(), createFlame(), createAura(), createBeam(), createOrb(), createSphere(), createImpact()];
    nodesRef.current.forEach(({ root }) => container.appendChild(root));

    let raf = 0;
    let previousHands = 0;
    let previousTwoHandDistance = 0;

    const frame = () => {
      const hands = handsRef.current.landmarks;
      const nodes = nodesRef.current;
      nodes.forEach(({ root }) => { root.style.opacity = "0"; });

      if (!enabled || !hands.length) {
        raf = requestAnimationFrame(frame);
        return;
      }

      // Every detected hand gets exactly one elemental state. This keeps effects attached to the user.
      hands.slice(0, 2).forEach((hand, i) => {
        const center = palmCenter(hand);
        const scale = handScale(hand);

        if (openPalm(hand)) {
          const flame = nodes[i];
          flame.root.style.width = `${Math.max(72, Math.min(155, scale * window.innerWidth * .78))}px`;
          flame.root.style.height = `${Math.max(82, Math.min(165, scale * window.innerWidth * .82))}px`;
          position(flame.root, { x: center.x, y: center.y - scale * .18 });
          flame.root.style.opacity = "1";
        } else if (fist(hand)) {
          position(nodes[2].root, center, Math.max(.7, Math.min(1.35, scale * 7)));
          nodes[2].root.style.opacity = ".95";
        } else if (point(hand)) {
          const tip = hand[8];
          const wrist = hand[0];
          if (tip && wrist) {
            const dx = (wrist.x - tip.x);
            const dy = (wrist.y - tip.y);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const beam = nodes[3].root;
            beam.style.left = `${(1 - tip.x) * 100}%`;
            beam.style.top = `${tip.y * 100}%`;
            beam.style.transform = `translate(0,-50%) rotate(${angle}deg)`;
            beam.style.opacity = ".9";
          }
        } else if (pinch(hand)) {
          const a = hand[4];
          const b = hand[8];
          if (a && b) {
            position(nodes[4].root, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, Math.max(.7, Math.min(1.25, scale * 8)));
            nodes[4].root.style.opacity = "1";
          }
        }
      });

      if (hands.length >= 2) {
        const a = palmCenter(hands[0]);
        const b = palmCenter(hands[1]);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const averageScale = (handScale(hands[0]) + handScale(hands[1])) / 2;
        const sphere = nodes[5].root;

        // Two open hands create a controllable energy sphere between them.
        if (openPalm(hands[0]) && openPalm(hands[1])) {
          const sphereSize = Math.max(.65, Math.min(1.7, distance / Math.max(averageScale * 3.4, .001)));
          position(sphere, mid, sphereSize);
          sphere.style.opacity = ".95";
        }

        // Pull the two hands apart/together to create an impact pulse.
        if (previousHands >= 2 && previousTwoHandDistance > .03) {
          const delta = Math.abs(distance - previousTwoHandDistance);
          if (delta > averageScale * .22) {
            position(nodes[6].root, mid, Math.max(.7, Math.min(1.7, delta / Math.max(averageScale, .001) * 1.8)));
            nodes[6].root.style.opacity = "1";
          }
        }
        previousTwoHandDistance = distance;
      } else {
        previousTwoHandDistance = 0;
      }

      previousHands = hands.length;
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      style.remove();
      nodesRef.current.forEach(({ root }) => root.remove());
      nodesRef.current = [];
    };
  }, [handsRef, enabled]);

  return <div ref={containerRef} className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" aria-hidden="true" />;
}
