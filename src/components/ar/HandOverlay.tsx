import { useEffect, useRef } from "react";
import type { HandState } from "./useHandTracking";

const CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

export function HandOverlay({
  handsRef,
  enabled,
}: {
  handsRef: React.RefObject<HandState>;
  enabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { clientWidth: w, clientHeight: h } = canvas;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      if (!enabled) return;

      const hands = handsRef.current?.landmarks ?? [];
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 320);

      for (const lm of hands) {
        const pt = (i: number) => {
          const p = lm[i] ?? { x: 0, y: 0, z: 0 };
          return { x: (1 - p.x) * w, y: p.y * h };
        };

        ctx.save();
        ctx.shadowColor = "rgba(34,255,225,0.9)";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = `rgba(34,255,225,${0.45 + 0.35 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const [a, b] of CONNECTIONS) {
          const p1 = pt(a);
          const p2 = pt(b);
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();

        lm.forEach((_, i) => {
          const p = pt(i);
          const tip = [4, 8, 12, 16, 20].includes(i);
          ctx.beginPath();
          ctx.fillStyle = tip ? "rgba(255,90,210,0.95)" : "rgba(180,255,250,0.9)";
          ctx.arc(p.x, p.y, tip ? 5 : 3, 0, Math.PI * 2);
          ctx.fill();
        });

        // Palm targeting reticle
        const c = pt(9);
        const r = 42 + 8 * pulse;
        ctx.strokeStyle = "rgba(255,90,210,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * 0.66, performance.now() / 600, performance.now() / 600 + Math.PI);
        ctx.stroke();
        ctx.restore();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [enabled, handsRef]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}
