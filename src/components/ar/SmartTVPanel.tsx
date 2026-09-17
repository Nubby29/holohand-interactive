import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Home,
  Link2,
  Minus,
  Play,
  Power,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";

type TVCommand =
  | "power"
  | "home"
  | "back"
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "play_pause"
  | "volume_up"
  | "volume_down"
  | "mute"
  | "channel_up"
  | "channel_down";

export type TVTargetRegistrar = (id: string) => (el: HTMLElement | null) => void;

interface SmartTVPanelProps {
  registerTarget: TVTargetRegistrar;
  onActivate: (id: string) => void;
}

const BRIDGE_URL = "ws://127.0.0.1:8765";

export function SmartTVPanel({ registerTarget, onActivate }: SmartTVPanelProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastCommand, setLastCommand] = useState("none");
  const [muted, setMuted] = useState(false);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const socket = new WebSocket(BRIDGE_URL);
      socketRef.current = socket;
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        socketRef.current = null;
      };
      socket.onerror = () => setConnected(false);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect]);

  const send = useCallback((command: TVCommand) => {
    const payload = JSON.stringify({ type: "tv-command", command, timestamp: Date.now() });
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(payload);
    setLastCommand(command.replaceAll("_", " "));
    if (command === "mute") setMuted((value) => !value);
    onActivate(`tv-${command}`);
  }, [onActivate]);

  const Button = ({ id, label, icon, command, wide = false }: { id: string; label: string; icon: ReactNode; command: TVCommand; wide?: boolean }) => (
    <button
      ref={registerTarget(id)}
      onClick={() => send(command)}
      className={`${wide ? "col-span-2" : ""} group flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[rgba(34,255,225,0.22)] bg-[rgba(4,15,28,0.72)] px-3 py-2 text-[rgb(34,255,225)] shadow-[inset_0_0_18px_rgba(34,255,225,0.03)] transition hover:border-[rgba(34,255,225,0.7)] hover:bg-[rgba(34,255,225,0.12)] hover:shadow-[0_0_22px_rgba(34,255,225,0.2)] active:scale-95`}
      aria-label={label}
    >
      {icon}
      <span className="font-mono text-[8px] tracking-[0.16em] text-white/65 uppercase group-hover:text-white">{label}</span>
    </button>
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-5">
      <section className="pointer-events-auto w-[min(92vw,430px)] rounded-3xl border border-[rgba(34,255,225,0.34)] bg-[rgba(2,9,18,0.84)] p-5 shadow-[0_0_80px_rgba(34,255,225,0.12)] backdrop-blur-2xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[rgb(34,255,225)]">
              <Link2 className="h-4 w-4" />
              <h2 className="font-mono text-xs tracking-[0.28em] uppercase">TV LINK</h2>
            </div>
            <p className="mt-1 font-mono text-[8px] tracking-widest text-white/40 uppercase">Local network media control</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 font-mono text-[8px] tracking-widest uppercase ${connected ? "border-[rgba(34,255,225,0.4)] text-[rgb(34,255,225)]" : "border-white/15 text-white/35"}`}>
            {connected ? "bridge online" : "bridge offline"}
          </span>
        </header>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Button id="tv-power" label="Power" command="power" icon={<Power className="h-4 w-4" />} />
          <Button id="tv-home" label="Home" command="home" icon={<Home className="h-4 w-4" />} />
          <Button id="tv-back" label="Back" command="back" icon={<RotateCcw className="h-4 w-4" />} />
        </div>

        <div className="mx-auto grid w-48 grid-cols-3 gap-2">
          <div />
          <Button id="tv-up" label="Up" command="up" icon={<ArrowUp className="h-4 w-4" />} />
          <div />
          <Button id="tv-left" label="Left" command="left" icon={<ArrowLeft className="h-4 w-4" />} />
          <Button id="tv-select" label="OK" command="select" icon={<span className="font-mono text-xs font-bold">OK</span>} />
          <Button id="tv-right" label="Right" command="right" icon={<ArrowRight className="h-4 w-4" />} />
          <div />
          <Button id="tv-down" label="Down" command="down" icon={<ArrowDown className="h-4 w-4" />} />
          <div />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button id="tv-play" label="Play / Pause" command="play_pause" icon={<Play className="h-4 w-4" />} wide />
          <Button id="tv-mute" label={muted ? "Unmute" : "Mute"} command="mute" icon={muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} />
          <Button id="tv-volume-up" label="Volume +" command="volume_up" icon={<Volume2 className="h-4 w-4" />} />
          <Button id="tv-volume-down" label="Volume -" command="volume_down" icon={<Minus className="h-4 w-4" />} />
          <Button id="tv-channel-up" label="Channel +" command="channel_up" icon={<ArrowUp className="h-4 w-4" />} />
          <Button id="tv-channel-down" label="Channel -" command="channel_down" icon={<ArrowDown className="h-4 w-4" />} />
        </div>

        <footer className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[8px] tracking-widest uppercase">
          <span className="text-white/30">last: {lastCommand}</span>
          <button onClick={connect} className="flex items-center gap-1 text-[rgb(34,255,225)]/65 hover:text-[rgb(34,255,225)]">
            <RotateCcw className="h-3 w-3" /> reconnect
          </button>
        </footer>
      </section>
    </div>
  );
}
