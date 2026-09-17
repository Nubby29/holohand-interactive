import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { HandState } from "./useHandTracking";

type FlameEffectProps = {
  handsRef: MutableRefObject<HandState>;
  enabled: boolean;
};

type FlameNode = {
  root: HTMLDivElement;
  aura: HTMLDivElement;
  core: HTMLDivElement;
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
  root.className = "pointer-events-none fixed z-[45]";
  root.style.width = "140px";
  root.style.height = "150px";
  root.style.transform = "translate(-50%, -88%)";
  root.style.opacity = "0";
  root.style.transition = "opacity 160ms ease, width 120ms ease, height 120ms ease";
  root.style.filter = "drop-shadow(0 0 14px rgba(255,80,15,.72))";

  const aura = document.createElement("div");
  aura.className = "absolute inset-[18%] rounded-full blur-2xl";
  aura.style.background = "radial-gradient(ellipse at center bottom, rgba(255,235,105,.62) 0%, rgba(255,100,15,.42) 35%, rgba(255,35,0,0) 74%)";
  root.appendChild(aura);

  const core = document.createElement("div");
  core.className = "absolute bottom-[5%] left-1/2 h-[42%] w-[42%] -translate-x-1/2 rounded-[50%_50%_45%_45%] blur-[3px]";
  core.style.background = "radial-gradient(ellipse at 50% 75%, rgba(255,255,245,.98) 0%, rgba(255,224,91,.92) 28%, rgba(255,116,12,.72) 63%, rgba(255,45,0,0) 100%)";
  core.style.animation = "holohandFlameCore 420ms ease-in-out infinite alternate";
  root.appendChild(core);

  const shapes = [
    { left: "34%", top: "2%", width: "32%", height: "88%", delay: "0ms", rotation: "-5deg", opacity: ".92" },
    { left: "12%", top: "22%", width: "40%", height: "66%", delay: "80ms", rotation: "-19deg", opacity: ".72" },
    { left: "47%", top: "16%", width: "40%", height: "72%", delay: "135ms", rotation: "15deg", opacity: ".78" },
    { left: "28%", top: "34%", width: "46%", height: "56%", delay: "210ms", rotation: "2deg", opacity: ".58" },
  ];

  for (const shape of shapes) {
    const tongue = document.createElement("div");
    tongue.className = "absolute origin-bottom";
    tongue.style.left = shape.left;
    tongue.style.top = shape.top;
    tongue.style.width = shape.width;
    tongue.style.height = shape.height;
    tongue.style.transform = `rotate(${shape.rotation})`;
    tongue.style.opacity = shape.opacity;
    tongue.style.animation = "holohandFlame 500ms ease-in-out infinite alternate";
    tongue.style.animationDelay = shape.delay;
    tongue.style.background = "linear-gradient(to top, rgba(255,35,0,.96) 0%, rgba(255,105,0,.94) 38%, rgba(255,215,67,.9) 72%, rgba(255,255,238,.94) 100%)";
    tongue.style.clipPath = "polygon(50% 0%, 68% 24%, 61% 42%, 88% 64%, 72% 100%, 28% 100%, 10% 66%, 36% 43%, 29% 25%)";
    tongue.style.borderRadius = "48% 48% 32% 32%";
    root.appendChild(tongue);
  }

  return { root, aura, core };
}

function createEmber() {
  const ember = document.createElement("div");
  ember.className = "absolute rounded-full";
  ember.style.width = "4px";
  ember.style.height = "4px";
  ember.style.background = "rgba(255,218,92,.95)";
  ember.style.boxShadow = "0 0 9px rgba(255,105,0,.95)";
  ember.style.animation = `holohandEmber ${900 + Math.random() * 700}ms ease-out infinite`;
  ember.style.animationDelay = `${Math.random() * -1400}ms`;
  return ember;
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
        0% { transform: translateY(3px) rotate(-5deg) scaleX(.90) scaleY(.94); }
        45% { transform: translateY(-5px) rotate(4deg) scaleX(1.05) scaleY(1.03); }
        100% { transform: translateY(-13px) rotate(-2deg) scaleX(.84) scaleY(1.08); }
      }
      @keyframes holohandFlameCore {
        0% { transform: translateX(-50%) scale(.92,.94); opacity:.78; }
        100% { transform: translateX(-50%) scale(1.08,1.04); opacity:1; }
      }
      @keyframes holohandEmber {
        0% { transform: translate(0, 10px) scale(.65); opacity:0; }
        15% { opacity:.9; }
        100% { transform: translate(var(--ember-x), -${55 + Math.random() * 55}px) scale(.12); opacity:0; }
      }
    `;
    container.appendChild(style);

    nodesRef.current = [createFlame(), createFlame()];
    nodesRef.current.forEach(({ root }) => {
      for (let i = 0; i < 7; i += 1) {
        const ember = createEmber();
        ember.style.left = `${25 + Math.random() * 50}%`;
        ember.style.top = `${40 + Math.random() * 40}%`;
        ember.style.setProperty("--ember-x", `${-35 + Math.random() * 70}px`);
        root.appendChild(ember);
      }
      container.appendChild(root);
    });

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
        const palmPoints = [5, 9, 13, 17].map((index) => hand[index]).filter(Boolean);
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

        // Keep the flame attached to the palm instead of covering the fingers.
        const width = Math.max(78, Math.min(190, handSize * window.innerWidth * 0.92));
        const height = width * 1.08;
        const mirroredX = 1 - palmX;

        node.root.style.left = `${mirroredX * 100}%`;
        node.root.style.top = `${palmY * 100}%`;
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

  return <div ref={containerRef} className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" aria-hidden="true" />;
}
