import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas-base bg-mesh-hero">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-6 inline-block rounded-full border border-hairline bg-glass px-4 py-1.5 font-display text-xs uppercase tracking-widest text-accent-cyan">
          v0.1 · Foundation
        </span>
        <h1 className="font-display text-6xl font-extrabold tracking-tightest text-white md:text-7xl">
          Fit<span className="bg-accent-gradient bg-clip-text text-transparent">List</span>
        </h1>
        <p className="mt-6 max-w-xl text-balance font-sans text-base text-white/70 md:text-lg">
          Premium nutritional intelligence. Weekly grocery lists generated from your budget, your
          goals, and your local supermarket — without the daily calorie diary.
        </p>
        <Link
          href="/design-system"
          className="group mt-12 inline-flex items-center gap-3 rounded-full bg-accent-gradient px-8 py-4 font-display text-base font-semibold text-canvas-base shadow-glow-cyan transition-all duration-300 ease-premium hover:scale-[1.03] active:scale-[0.98]"
        >
          Open Design System
          <span className="transition-transform duration-300 ease-premium group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </main>
  );
}
