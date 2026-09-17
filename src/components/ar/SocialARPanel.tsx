import { useState, type ReactNode } from "react";
import {
  Bell,
  Camera,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  UserRound,
  Users,
  X,
} from "lucide-react";

type SocialTab = "feed" | "profile" | "notifications" | "messages";

type SocialPost = {
  id: string;
  name: string;
  handle: string;
  time: string;
  initials: string;
  body: string;
  accent: string;
  likes: number;
  comments: number;
};

const POSTS: SocialPost[] = [
  {
    id: "1",
    name: "Mika Santos",
    handle: "@mika",
    time: "12m",
    initials: "MS",
    body: "Testing the new holographic workspace. This feels like the future.",
    accent: "rgba(34,255,225,0.18)",
    likes: 128,
    comments: 18,
  },
  {
    id: "2",
    name: "Kenji Park",
    handle: "@kenji",
    time: "38m",
    initials: "KP",
    body: "Built a tiny spatial gallery today. Pinch, drag, and walk around it.",
    accent: "rgba(255,90,210,0.16)",
    likes: 84,
    comments: 9,
  },
  {
    id: "3",
    name: "Luna Reyes",
    handle: "@luna",
    time: "1h",
    initials: "LR",
    body: "The camera overlay is surprisingly good in low light tonight.",
    accent: "rgba(88,120,255,0.18)",
    likes: 56,
    comments: 7,
  },
];

export type SocialARPanelProps = {
  registerTarget: (id: string) => (el: HTMLElement | null) => void;
  onClose: () => void;
  onActivate?: (id: string) => void;
};

export function SocialARPanel({ registerTarget, onClose, onActivate }: SocialARPanelProps) {
  const [tab, setTab] = useState<SocialTab>("feed");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState(false);

  const selectTab = (next: SocialTab) => {
    setTab(next);
    onActivate?.(`social-${next}`);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-5 sm:p-8">
      <section className="pointer-events-auto relative flex h-[min(76vh,680px)] w-[min(92vw,760px)] flex-col overflow-hidden rounded-[28px] border border-[rgba(34,255,225,0.32)] bg-[linear-gradient(145deg,rgba(3,15,28,0.92),rgba(8,7,24,0.88))] shadow-[0_0_90px_rgba(34,255,225,0.14),inset_0_0_80px_rgba(255,90,210,0.035)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(34,255,225,0.13),transparent_28%),radial-gradient(circle_at_90%_90%,rgba(255,90,210,0.1),transparent_28%)]" />

        <header className="relative flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(34,255,225,0.3)] bg-[rgba(34,255,225,0.08)] shadow-[0_0_22px_rgba(34,255,225,0.12)]">
              <Users className="h-5 w-5 text-[rgb(34,255,225)]" />
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-[rgb(34,255,225)]">HOLO SOCIAL</p>
              <p className="mt-1 text-xs text-white/45">AR-native social space</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              ref={registerTarget("social-connect")}
              onClick={() => setConnected((value) => !value)}
              className={`rounded-full border px-3 py-2 font-mono text-[9px] tracking-widest uppercase transition ${connected ? "border-[rgba(34,255,225,0.45)] bg-[rgba(34,255,225,0.1)] text-[rgb(34,255,225)]" : "border-white/15 bg-white/5 text-white/65 hover:border-[rgba(34,255,225,0.35)] hover:text-[rgb(34,255,225)]"}`}
            >
              {connected ? "facebook linked" : "connect facebook"}
            </button>
            <button ref={registerTarget("social-close")} onClick={onClose} aria-label="Close social" className="rounded-full border border-white/10 bg-white/5 p-2 text-white/55 transition hover:border-[rgba(255,90,210,0.45)] hover:text-[rgb(255,90,210)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <nav className="relative flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-4 py-2 sm:px-5">
          <SocialNavButton id="social-feed" label="Feed" icon={<MessageCircle />} active={tab === "feed"} registerTarget={registerTarget} onClick={() => selectTab("feed")} />
          <SocialNavButton id="social-profile" label="Profile" icon={<UserRound />} active={tab === "profile"} registerTarget={registerTarget} onClick={() => selectTab("profile")} />
          <SocialNavButton id="social-notifications" label="Alerts" icon={<Bell />} active={tab === "notifications"} registerTarget={registerTarget} onClick={() => selectTab("notifications")} />
          <SocialNavButton id="social-messages" label="Messages" icon={<Send />} active={tab === "messages"} registerTarget={registerTarget} onClick={() => selectTab("messages")} />
        </nav>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {tab === "feed" && (
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="font-mono text-[9px] tracking-[0.25em] text-white/40 uppercase">Personal feed</p><h2 className="mt-1 text-lg font-semibold text-white">Your social field</h2></div>
                <div className="rounded-full border border-[rgba(34,255,225,0.2)] px-3 py-1.5 font-mono text-[8px] tracking-widest text-[rgb(34,255,225)]/70 uppercase">LIVE UI</div>
              </div>
              <div ref={registerTarget("social-composer")} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex gap-3"><Avatar initials="JF" /><div className="flex-1"><p className="text-sm text-white/45">What is happening in your world?</p><div className="mt-3 flex gap-2"><ComposerButton icon={<Camera />} label="Camera" /><ComposerButton icon={<ImageIcon />} label="Gallery" /></div></div></div>
              </div>
              {POSTS.map((post) => (
                <article key={post.id} ref={registerTarget(`social-post-${post.id}`)} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_8px_30px_rgba(0,0,0,0.16)]">
                  <div className="flex items-center justify-between px-4 pt-4"><div className="flex items-center gap-3"><Avatar initials={post.initials} /><div><p className="text-sm font-medium text-white">{post.name}</p><p className="text-[10px] text-white/35">{post.handle} · {post.time}</p></div></div><MoreHorizontal className="h-4 w-4 text-white/30" /></div>
                  <p className="px-4 py-4 text-sm leading-6 text-white/75">{post.body}</p>
                  <div className="mx-4 h-28 rounded-xl border border-white/10" style={{ background: `radial-gradient(circle at 30% 30%, ${post.accent}, transparent 50%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))` }}><div className="flex h-full items-center justify-center font-mono text-[8px] tracking-[0.28em] text-white/20 uppercase">spatial media</div></div>
                  <div className="flex items-center gap-1 px-3 py-3"><ReactionButton id={`social-like-${post.id}`} icon={<Heart className="h-4 w-4" />} label={`${post.likes + (liked[post.id] ? 1 : 0)}`} active={!!liked[post.id]} registerTarget={registerTarget} onClick={() => setLiked((current) => ({ ...current, [post.id]: !current[post.id] }))} /><ReactionButton id={`social-comment-${post.id}`} icon={<MessageCircle className="h-4 w-4" />} label={`${post.comments}`} registerTarget={registerTarget} onClick={() => onActivate?.(`comment-${post.id}`)} /><ReactionButton id={`social-share-${post.id}`} icon={<Share2 className="h-4 w-4" />} label="Share" registerTarget={registerTarget} onClick={() => onActivate?.(`share-${post.id}`)} /></div>
                </article>
              ))}
            </div>
          )}

          {tab === "profile" && <ProfileView registerTarget={registerTarget} connected={connected} />}
          {tab === "notifications" && <SimpleView title="Notifications" subtitle="Recent social activity" icon={<Bell />} items={["Mika reacted to your post", "Kenji mentioned you in a post", "Luna started following you"]} registerTarget={registerTarget} />}
          {tab === "messages" && <SimpleView title="Messages" subtitle="Your conversations" icon={<MessageCircle />} items={["Mika · See you in the spatial gallery!", "Kenji · The prototype is ready", "Luna · That camera effect is wild"]} registerTarget={registerTarget} />}
        </div>

        <footer className="relative flex shrink-0 items-center justify-between border-t border-white/10 px-5 py-3 font-mono text-[8px] tracking-widest text-white/30 uppercase sm:px-6">
          <span>point + pinch · spatial interaction</span>
          <span className="text-[rgb(34,255,225)]/55">graph api ready</span>
        </footer>
      </section>
    </div>
  );
}

function SocialNavButton({ id, label, icon, active, registerTarget, onClick }: { id: string; label: string; icon: ReactNode; active: boolean; registerTarget: SocialARPanelProps["registerTarget"]; onClick: () => void }) {
  return <button ref={registerTarget(id)} onClick={onClick} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 font-mono text-[9px] tracking-widest uppercase transition ${active ? "bg-[rgba(34,255,225,0.1)] text-[rgb(34,255,225)]" : "text-white/40 hover:bg-white/5 hover:text-white/70"}`}>{icon}<span>{label}</span></button>;
}

function Avatar({ initials }: { initials: string }) { return <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(34,255,225,0.28)] bg-[linear-gradient(135deg,rgba(34,255,225,0.15),rgba(255,90,210,0.12))] font-mono text-[9px] text-white/80">{initials}</div>; }

function ComposerButton({ icon, label }: { icon: ReactNode; label: string }) { return <button className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/45 transition hover:border-white/20 hover:text-white/70">{icon}<span>{label}</span></button>; }

function ReactionButton({ id, icon, label, active = false, registerTarget, onClick }: { id: string; icon: ReactNode; label: string; active?: boolean; registerTarget: SocialARPanelProps["registerTarget"]; onClick: () => void }) { return <button ref={registerTarget(id)} onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] transition ${active ? "bg-[rgba(255,90,130,0.1)] text-[rgb(255,90,130)]" : "text-white/40 hover:bg-white/5 hover:text-white/75"}`}>{icon}<span>{label}</span></button>; }

function ProfileView({ registerTarget, connected }: { registerTarget: SocialARPanelProps["registerTarget"]; connected: boolean }) {
  return <div className="mx-auto max-w-2xl"><div ref={registerTarget("social-profile-card")} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="flex flex-wrap items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(255,90,210,0.35)] bg-[rgba(255,90,210,0.08)] font-mono text-sm text-white">JF</div><div><h2 className="text-xl font-semibold text-white">HoloHand User</h2><p className="text-sm text-white/40">@holohand · spatial creator</p></div></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><Stat label="Posts" value="42" /><Stat label="Friends" value="318" /><Stat label="Following" value="201" /></div><div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-white/55">{connected ? "Facebook connection is active. Replace this shell with authenticated Graph API data when the Meta app credentials and approved permissions are configured." : "Connect Facebook to prepare the account for API-backed profile data."}</div></div></div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><p className="text-sm font-semibold text-white">{value}</p><p className="mt-1 font-mono text-[8px] tracking-widest text-white/35 uppercase">{label}</p></div>; }

function SimpleView({ title, subtitle, icon, items, registerTarget }: { title: string; subtitle: string; icon: ReactNode; items: string[]; registerTarget: SocialARPanelProps["registerTarget"] }) {
  return <div className="mx-auto max-w-2xl"><div className="mb-4 flex items-center gap-3"><div className="rounded-xl border border-[rgba(34,255,225,0.25)] bg-[rgba(34,255,225,0.07)] p-3 text-[rgb(34,255,225)]">{icon}</div><div><h2 className="text-lg font-semibold text-white">{title}</h2><p className="text-xs text-white/40">{subtitle}</p></div></div><div className="space-y-2">{items.map((item, index) => <button key={item} ref={registerTarget(`social-item-${index}`)} className="flex w-full items-center rounded-xl border border-white/10 bg-white/[0.035] px-4 py-4 text-left text-sm text-white/65 transition hover:border-[rgba(34,255,225,0.25)] hover:bg-white/[0.055]"><div className="mr-3 h-2 w-2 rounded-full bg-[rgb(34,255,225)] shadow-[0_0_10px_rgba(34,255,225,0.65)]" />{item}</button>)}</div></div>;
}
