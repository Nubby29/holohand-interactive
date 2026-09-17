import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ARExperience = lazy(() => import("@/components/ar/ARExperience"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurora Handspace — AR Hand-Tracking Gesture Interface" },
      {
        name: "description",
        content:
          "Control a holographic AR menu with your hands. Live webcam hand tracking, a futuristic HUD overlay and a downward swipe gesture to summon the interface.",
      },
      { property: "og:title", content: "Aurora Handspace — AR Hand-Tracking Gesture Interface" },
      {
        property: "og:description",
        content:
          "Swipe your hand downward in front of the webcam to open a sleek holographic menu with live gesture tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <ClientOnly fallback={<Loading />}>
        <Suspense fallback={<Loading />}>
          <ARExperience />
        </Suspense>
      </ClientOnly>
    </main>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="font-mono text-xs tracking-[0.35em] text-[rgb(34,255,225)] uppercase">
        booting handspace…
      </p>
    </div>
  );
}
