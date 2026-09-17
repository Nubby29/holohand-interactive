import { useEffect, useRef, useState } from "react";
import { Move, Rotate3D, Scaling } from "lucide-react";
import type { TwoHandTransform } from "./useHandTracking";
import { sfx } from "./sfx";

type Pointer = { x: number; y: number; active: boolean };

type Props = {
  pointer: Pointer;
  pinching: boolean;
  twoHandTransform: TwoHandTransform;
};

export function SpatialHologram({ pointer, pinching, twoHandTransform }: Props) {
  const [position, setPosition] = useState({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [grabbed, setGrabbed] = useState(false);
  const [transforming, setTransforming] = useState(false);

  const objectRef = useRef<HTMLDivElement | null>(null);
  const grabbedRef = useRef(false);
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const twoHandRef = useRef({
    active: false,
    distance: 0,
    angle: 0,
    scale: 1,
    rotation: 0,
  });

  useEffect(() => {
    if (!pointer.active || !objectRef.current || twoHandTransform.active) {
      if (twoHandTransform.active && grabbedRef.current) {
        grabbedRef.current = false;
        setGrabbed(false);
      }
      if (!twoHandTransform.active && transforming) setTransforming(false);
      if (!pointer.active && grabbedRef.current) {
        grabbedRef.current = false;
        setGrabbed(false);
      }
      return;
    }

    const r = objectRef.current.getBoundingClientRect();
    const overObject =
      pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;

    if (!grabbedRef.current) {
      setHovered(overObject);
      if (pinching && overObject) {
        grabbedRef.current = true;
        grabOffsetRef.current = {
          x: pointer.x - (r.left + r.width / 2),
          y: pointer.y - (r.top + r.height / 2),
        };
        setGrabbed(true);
        sfx.select();
      }
      return;
    }

    if (!pinching) {
      grabbedRef.current = false;
      setGrabbed(false);
      sfx.hover();
      return;
    }

    setPosition({
      x: pointer.x - grabOffsetRef.current.x,
      y: pointer.y - grabOffsetRef.current.y,
    });
  }, [pointer, pinching, twoHandTransform.active, transforming]);

  useEffect(() => {
    if (!twoHandTransform.active) {
      if (twoHandRef.current.active) {
        twoHandRef.current.active = false;
        setTransforming(false);
        sfx.hover();
      }
      return;
    }

    if (!twoHandRef.current.active) {
      twoHandRef.current = {
        active: true,
        distance: twoHandTransform.distance,
        angle: twoHandTransform.angle,
        scale,
        rotation,
      };
      setTransforming(true);
      setHovered(false);
      sfx.select();
      return;
    }

    const start = twoHandRef.current;
    if (start.distance > 1) {
      const nextScale = Math.max(
        0.55,
        Math.min(2.2, start.scale * (twoHandTransform.distance / start.distance)),
      );
      setScale(nextScale);
    }

    let delta = twoHandTransform.angle - start.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    setRotation(start.rotation + (delta * 180) / Math.PI);

    setPosition({ x: twoHandTransform.centerX, y: twoHandTransform.centerY });
  }, [twoHandTransform, scale, rotation]);

  return (
    <div
      ref={objectRef}
      className={`absolute z-10 h-36 w-56 -translate-x-1/2 -translate-y-1/2 rounded-3xl border backdrop-blur-xl transition-shadow duration-200 ${
        transforming
          ? "border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.14)] shadow-[0_0_80px_rgba(255,90,210,0.65)]"
          : grabbed
            ? "border-[rgb(255,90,210)] bg-[rgba(255,90,210,0.14)] shadow-[0_0_70px_rgba(255,90,210,0.55)]"
            : hovered
              ? "border-[rgb(34,255,225)] bg-[rgba(34,255,225,0.13)] shadow-[0_0_55px_rgba(34,255,225,0.5)]"
              : "border-[rgba(34,255,225,0.38)] bg-[rgba(4,12,22,0.45)] shadow-[0_0_45px_rgba(34,255,225,0.18)]"
      }`}
      style={{
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
      }}
    >
      <div className="absolute inset-2 rounded-2xl border border-white/10" />
      <div className="relative flex h-full flex-col items-center justify-center text-center">
        {transforming ? (
          <div className="flex items-center gap-3">
            <Rotate3D className="h-5 w-5 text-[rgb(255,90,210)]" />
            <Scaling className="h-5 w-5 text-[rgb(255,90,210)]" />
          </div>
        ) : (
          <Move className={`h-6 w-6 ${grabbed ? "text-[rgb(255,90,210)]" : "text-[rgb(34,255,225)]"}`} />
        )}
        <p className="mt-3 font-mono text-xs tracking-[0.28em] text-white uppercase">
          {transforming ? "transforming" : grabbed ? "object grabbed" : "spatial object"}
        </p>
        <p className="mt-1 font-mono text-[10px] tracking-widest text-white/45 uppercase">
          {transforming
            ? "spread = scale · twist = rotate"
            : grabbed
              ? "release pinch to drop"
              : "pinch + drag to move"}
        </p>
      </div>
      <div className="pointer-events-none absolute -inset-3 rounded-[28px] border border-[rgba(34,255,225,0.08)]" />
    </div>
  );
}
