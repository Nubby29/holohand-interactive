import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { HandState } from "./useHandTracking";

type FlameEffectProps = {
  handsRef: MutableRefObject<HandState>;
  enabled: boolean;
};

type FlameNode = {
  root: HTMLDivElement;
};

function isOpenPalm(hand: HandState["landmarks"][number]) {
  const wrist = hand[0];
  if (!wrist || !hand[9]) return false;

  const pairs: Array<[number, number]> = [[8, 6], [12, 10], [16, 14], [20, 18]];
  const extended = pairs.every(([tipIndex, pipIndex]) => {
    const tip = hand[tipIndex];
    const pip = hand[pipIndex];
    return !!tip && !!pip && Math.hypot(tip.x - wrist.x, tip.y - wrist.y) > Math.hypot(pip.x - wrist.x, pip.y - wrist.y) * 1.08;
  });

  if (!extended) return false;
  const index = hand[8];
  const pinky = hand[20];
  if (!index || !pinky) return false;

  const spread = Math.hypot(index.x - pinky.x, index.y - pinky.y);
  const palm = Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y) || 0.0001;
  return spread / palm > 1.05;
}

function createFlame() {
  const root = document.createElement("div");
  root.className = "pointer-events-none fixed z-[45]";
  root.style.transform = "translate(-50%, -92%)";
  root.style.opacity = "0";
  root.style.willChange = "left, top, width, height, opacity";
  root.style.filter = "drop-shadow(0 0 16px rgba(255,80,15,.75))";

  const aura = document.createElement("div");
  aura.className = "absolute inset-[-22%] rounded-full blur-2xl";
  aura.style.background = "radial-gradient(ellipse at center bottom, rgba(255,242,125,.42) 0%, rgba(255,90,10,.3) 35%, rgba(255,20,0,0) 72%)";
  root.appendChild(aura);

  const core = document.createElement("div");
  core.className = "absolute bottom-[3%] left-1/2 h-[42%] w-[40%] -translate-x-1/2 rounded-[50%_50%_45%_45%] blur-[4px]";
  core.style.background = "radial-gradient(ellipse at 50% 75%, rgba(255,255,250,.98) 0%, rgba(255,226,105,.9) 25%, rgba(255,105,8,.68) 60%, rgba(255,30,0,0) 100%)";
  core.style.animation = "holohandFlameCore 420ms ease-in-out infinite alternate";
  root.appendChild(core);

  const shapes = [
    ["34%", "2%", "31%", "88%", "-6deg", "0ms", ".9"],
    ["10%", "25%", "40%", "64%", "-20deg", "75ms", ".66"],
    ["49%", "18%", "39%", "70%", "16deg", "135ms", ".72"],
    ["28%", "38%", "45%", "53%", "2deg", "210ms", ".5"],
  ];

  for (const [left, top, width, height, rotation, delay, opacity] of shapes) {
    const tongue = document.createElement("div");
    tongue.className = "absolute origin-bottom";
    tongue.style.left = left;
    tongue.style.top = top;
    tongue.style.width = width;
    tongue.style.height = height;
    tongue.style.transform = `rotate(${rotation})`;
    tongue.style.opacity = opacity;
    tongue.style.animation = "holohandFlame 500ms ease-in-out infinite alternate";
    tongue.style.animationDelay = delay;
    tongue.style.background = "linear-gradient(to top, rgba(255,32,0,.95), rgba(255,105,0,.92) 38%, rgba(255,215,65,.88) 72%, rgba(255,255,238,.94))";
    tongue.style.clipPath = "polygon(50% 0%, 68% 24%, 61% 42%, 88% 64%, 72% 100%, 28% 100%, 10% 66%, 36% 43%, 29% 25%)";
    tongue.style.borderRadius = "48% 48% 32% 32%";
    root.appendChild(tongue);
  }

  // Small particles make the effect read as volumetric instead of a flat icon.
  for (let i = 0; i < 8; i += 1) {
    const ember = document.createElement("span");
    ember.className = "absolute rounded-full";
    const size = 2 + Math.random() * 3;
    ember.style.width = `${size}px`;
    ember.style.height = `${size}px`;
    ember.style.left = `${22 + Math.random() * 56}%`;
    ember.style.top = `${42 + Math.random() * 38}%`;
    ember.style.background = "rgba(255,225,105,.95)";
    ember.style.boxShadow = "0 0 9px rgba(255,100,0,.95)";
    ember.style.setProperty("--ember-x", `${-35 + Math.random() * 70}px`);
    ember.style.setProperty("--ember-y", `${-60 - Math.random() * 65}px`);
    ember.style.animation = "holohandEmber 900ms ease-out infinite";
    ember.style.animationDelay = `${Math.random() * -1400}ms`;
    root.appendChild(ember);
  }

  return { root };
}

export function FlameEffect({ handsRef, enabled }: FlameEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<FlameNode[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes holohandFlame {
        0% { transform: translateY(3px) rotate(-5deg) scaleX(.9) scaleY(.94); }
        50% { transform: translateY(-5px) rotate(4deg) scaleX(1.05) scaleY(1.03); }
        100% { transform: translateY(-13px) rotate(-2deg) scaleX(.84) scaleY(1.08); }
      }
      @keyframes holohandFlameCore {
        0% { transform: translateX(-50%) scale(.92,.94); opacity:.76; }
        100% { transform: translateX(-50%) scale(1.08,1.04); opacity:1; }
      }
      @keyframes holohandEmber {
        0% { transform: translate(0, 8px) scale(.65); opacity:0; }
        15% { opacity:.9; }
        100% { transform: translate(var(--ember-x), var(--ember-y)) scale(.08); opacity:0; }
      }
    `;
    container.appendChild(style);

    nodesRef.current = [createFlame(), createFlame()];
    nodesRef.current.forEach(({ root }) => container.appendChild(root));

    let raf = 0;
    const frame = () => {
      const hands = handsRef.current.landmarks;

      nodesRef.current.forEach((node, i) => {
        const hand = hands[i];
        if (!enabled || !hand || !isOpenPalm(hand)) {
          node.root.style.opacity = "0";
          return;
        }

        const wrist = hand[0];
        const palmPoints = [5, 9, 13, 17].map((index) => hand[index]).filter(Boolean);
        if (!wrist || palmPoints.length < 4 || !hand[9]) {
          node.root.style.opacity = "0";
          return;
        }

        const palm = palmPoints.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
        const palmX = palm.x / palmPoints.length;
        const palmY = palm.y / palmPoints.length;
        const handSize = Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y) || 0.08;

        // The fire source sits just above the palm center, leaving the fingers visible.
        const width = Math.max(68, Math.min(155, handSize * window.innerWidth * 0.78));
        const height = width * 1.05;
        const mirroredX = 1 - palmX;
        const palmLift = handSize * 0.18;

        node.root.style.left = `${mirroredX * 100}%`;
        node.root.style.top = `${Math.max(8, (palmY - palmLift) * 100)}%`;
        node.root.style.width = `${width}px`;
        node.root.style.height = `${height}px`;
        node.root.style.opacity = "1";
      });

      raf = window.requestAnimationFrame(frame);
    };

    raf = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(raf);
      style.remove();
      nodesRef.current.forEach(({ root }) => root.remove());
      nodesRef.current = [];
    };
  }, [handsRef, enabled]);

  return <div ref={containerRef} className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" aria-hidden="true" />;
}
