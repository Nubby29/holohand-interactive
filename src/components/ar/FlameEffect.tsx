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

  const pairs: Array<[number, number]> = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];

  const extended = pairs.every(([tipIndex, pipIndex]) => {
    const tip = hand[tipIndex];
    const pip = hand[pipIndex];
    if (!tip || !pip) return false;
    return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) > Math.hypot(pip.x - wrist.x, pip.y - wrist.y) * 1.08;
  });

  if (!extended) return false;

  const index = hand[8];
  const pinky = hand[20];
  if (!index || !pinky) return false;

  const spread = Math.hypot(index.x - pinky.x, index.y - pinky.y);
  const palm = Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y) || 0.0001;
  return spread / palm > 1.05;
}

function createFlame(): FlameNode {
  const root = document.createElement("div");
  root.className = "pointer-events-none fixed z-[55]";
  root.style.width = "120px";
  root.style.height = "150px";
  root.style.transform = "translate(-50%, -50%)";
  root.style.filter = "drop-shadow(0 0 18px rgba(255,90,30,.9))";
  root.style.opacity = "0";
  root.style.transition = "opacity 120ms ease, width 120ms ease, height 120ms ease";

  const aura = document.createElement("div");
  aura.className = "absolute inset-[15%] rounded-full blur-2xl";
  aura.style.background = "radial-gradient(circle, rgba(255,235,105,.95) 0%, rgba(255,90,20,.58) 38%, rgba(255,30,0,0) 72%)";
  root.appendChild(aura);

  const shapes = [
    { left: "38%", top: "4%", width: "30%", height: "76%", delay: "0ms", rotation: "-7deg" },
    { left: "17%", top: "18%", width: "38%", height: "62%", delay: "90ms", rotation: "-22deg" },
    { left: "48%", top: "22%", width: "42%", height: "58%", delay: "150ms", rotation: "17deg" },
  ];

  for (const shape of shapes) {
    const tongue = document.createElement("div");
    tongue.className = "absolute origin-bottom";
    tongue.style.left = shape.left;
    tongue.style.top = shape.top;
    tongue.style.width = shape.width;
    tongue.style.height = shape.height;
    tongue.style.transform = `rotate(${shape.rotation})`;
    tongue.style.animation = "holohandFlame 520ms ease-in-out infinite alternate";
    tongue.style.animationDelay = shape.delay;
    tongue.style.background = "linear-gradient(to top, #ff2400 0%, #ff7a00 42%, #ffe96b 76%, rgba(255,255,255,.98) 100%)";
    tongue.style.clipPath = "polygon(50% 0%, 72% 25%, 65% 43%, 90% 67%, 73% 100%, 27% 100%, 8% 67%, 35% 43%, 28% 25%)";
    tongue.style.borderRadius = "45% 45% 30% 30%";
    root.appendChild(tongue);
  }

  return { root };
}

export function FlameEffect({ handsRef, enabled }: FlameEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<FlameNode[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes holohandFlame {
        0% { transform: translateY(3px) rotate(-5deg) scaleX(.92) scaleY(.94); }
        45% { transform: translateY(-5px) rotate(4deg) scaleX(1.04) scaleY(1.04); }
        100% { transform: translateY(-12px) rotate(-2deg) scaleX(.88) scaleY(1.08); }
      }
    `;
    container.appendChild(style);

    nodesRef.current = [createFlame(), createFlame()];
    nodesRef.current.forEach(({ root }) => container.appendChild(root));

    let raf = 0;
    const frame = () => {
      const hands = handsRef.current.landmarks;
      const nodes = nodesRef.current;

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const hand = hands[i];
        if (!enabled || !hand || !isOpenPalm(hand)) {
          node.root.style.opacity = "0";
          continue;
        }

        const wrist = hand[0];
        const palmPoints = [5, 9, 13, 17].flatMap((index) => {
          const point = hand[index];
          return point ? [point] : [];
        });
        if (!wrist || palmPoints.length < 4 || !hand[9]) {
          node.root.style.opacity = "0";
          continue;
        }

        const palm = palmPoints.reduce(
          (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
          { x: 0, y: 0 },
        );
        const palmX = palm.x / palmPoints.length;
        const palmY = palm.y / palmPoints.length;
        const handSize = Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y) || 0.08;
        const width = Math.max(78, Math.min(230, handSize * window.innerWidth * 2.7));
        const height = width * 1.18;

        node.root.style.left = `${(1 - palmX) * 100}%`;
        node.root.style.top = `${Math.max(8, (palmY - handSize * 1.05) * 100)}%`;
        node.root.style.width = `${width}px`;
        node.root.style.height = `${height}px`;
        node.root.style.opacity = "1";
      }

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

  return <div ref={containerRef} className="pointer-events-none fixed inset-0 z-[55] overflow-hidden" aria-hidden="true" />;
}
