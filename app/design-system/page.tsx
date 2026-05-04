'use client';

import Link from 'next/link';
import { Body, Caption, DataNumber, H1, H2, H3, H4, H5 } from '@/components/ui/Typography';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { GlassCard } from '@/components/ui/GlassCard';
import { GroceryCard } from '@/components/ui/GroceryCard';
import { RadialProgress } from '@/components/ui/RadialProgress';

const colorTokens = [
  { name: 'Midnight Blue', hex: '#0A0F1A', role: 'canvas / base', swatchClassName: 'bg-canvas-base' },
  { name: 'Rich Charcoal', hex: '#121212', role: 'canvas / raised', swatchClassName: 'bg-canvas-raised' },
  { name: 'Elevated Gray', hex: '#1E1E24', role: 'canvas / elevated', swatchClassName: 'bg-canvas-elevated' },
  { name: 'Electric Cyan', hex: '#00F0FF', role: 'accent / primary', swatchClassName: 'bg-accent-cyan' },
  { name: 'Vibrant Mint', hex: '#00E676', role: 'accent / success', swatchClassName: 'bg-accent-mint' },
  { name: 'Coral', hex: '#FF6B6B', role: 'warn / over-budget', swatchClassName: 'bg-warn-coral' },
  { name: 'Action Orange', hex: '#FF8E53', role: 'warn / milestone', swatchClassName: 'bg-warn-orange' },
  { name: 'Hairline', hex: 'rgba(255,255,255,0.05)', role: 'border / subtle', swatchClassName: 'bg-white/[0.05]' },
];

const dietaryOptions = [
  { value: 'omnivore', label: 'Omnivore' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Ketogenic' },
];

const supermarketOptions = [
  { value: 'carrefour', label: 'Carrefour' },
  { value: 'coto', label: 'Coto' },
  { value: 'jumbo', label: 'Jumbo' },
  { value: 'dia', label: 'Día' },
];

function SectionLabel({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-10 flex flex-col gap-3">
      <H5>{kicker}</H5>
      <H2>{title}</H2>
      {children && <Body className="max-w-2xl">{children}</Body>}
    </header>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas-base bg-mesh-hero">
      {/* Top nav */}
      <nav className="sticky top-0 z-30 border-b border-hairline bg-canvas-base/70 backdrop-blur-glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-xl font-extrabold tracking-tightest">
              Fit<span className="bg-accent-gradient bg-clip-text text-transparent">List</span>
            </span>
            <span className="rounded-full border border-hairline bg-glass px-2.5 py-0.5 font-display text-[10px] uppercase tracking-widest text-white/55">
              Design System
            </span>
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <a href="#typography" className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white">Typography</a>
            <a href="#color" className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white">Color</a>
            <a href="#buttons" className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white">Buttons</a>
            <a href="#forms" className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white">Forms</a>
            <a href="#cards" className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white">Cards</a>
            <a href="#data" className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white">Data</a>
          </div>
          <Button variant="outline" size="sm">v0.1.0</Button>
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-32 pt-20 md:pt-28">
        {/* COVER ----------------------------------------------------------- */}
        <section className="mb-32 animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-glass px-4 py-1.5 font-display text-xs uppercase tracking-widest text-accent-cyan">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-mint" />
            Foundation Kit
          </span>
          <H1 className="mt-6 max-w-4xl">
            The visual <span className="bg-accent-gradient bg-clip-text text-transparent">language</span> of FitList.
          </H1>
          <Body className="mt-6 max-w-2xl text-lg">
            A premium, dark-mode design system built for nutritional intelligence at scale.
            Every primitive on this page is a real, production-ready React component — wired to
            tokenized brand colors, Outfit + Inter typography, glassmorphism, and 300ms
            cubic-bezier micro-animations.
          </Body>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <GlassCard variant="strong">
              <Caption>Built on</Caption>
              <H4 className="mt-2">Next.js + Tailwind</H4>
              <Body className="mt-2 text-sm">
                App Router, TypeScript, zero runtime CSS-in-JS. Brand tokens live in
                <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">tailwind.config.js</code>.
              </Body>
            </GlassCard>
            <GlassCard variant="strong">
              <Caption>Aesthetic</Caption>
              <H4 className="mt-2">Premium · Dynamic</H4>
              <Body className="mt-2 text-sm">
                Inspired by Nike Run Club & Apple Fitness — sleek, alive, trustworthy. No
                generic medical-app vibes anywhere on this surface.
              </Body>
            </GlassCard>
            <GlassCard variant="strong">
              <Caption>Animation</Caption>
              <H4 className="mt-2">300ms · ease-premium</H4>
              <Body className="mt-2 text-sm">
                Custom <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">cubic-bezier(0.16, 1, 0.3, 1)</code> applied to every hover, focus, and state change.
              </Body>
            </GlassCard>
          </div>
        </section>

        {/* TYPOGRAPHY ------------------------------------------------------ */}
        <section id="typography" className="mb-32 scroll-mt-24">
          <SectionLabel kicker="01 — Typography" title="Outfit for display, Inter for body.">
            Headers run pure white with tightest tracking for that premium, heavy-confidence look.
            Data numerals are tabular so budgets and macros align cleanly in lists.
          </SectionLabel>

          <GlassCard className="space-y-8 p-10">
            <div>
              <Caption>H1 — Display</Caption>
              <H1 className="mt-2">Boom. You hit your macros.</H1>
            </div>
            <div>
              <Caption>H2 — Section</Caption>
              <H2 className="mt-2">This week&apos;s grocery plan</H2>
            </div>
            <div>
              <Caption>H3 — Subsection</Caption>
              <H3 className="mt-2">Pechuga de Pollo · 500g</H3>
            </div>
            <div>
              <Caption>H4 — Card title</Caption>
              <H4 className="mt-2">Weekly Budget Limit</H4>
            </div>
            <div>
              <Caption>H5 — Kicker</Caption>
              <H5 className="mt-2">Macro Distribution</H5>
            </div>
            <div>
              <Caption>Body</Caption>
              <Body className="mt-2 max-w-2xl">
                FitList builds your weekly grocery list from real, scraped supermarket prices —
                calibrated to your fitness goals and budget. No daily diary. No friction.
              </Body>
            </div>
            <div className="grid gap-6 border-t border-hairline pt-8 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Caption>Budget · cyan</Caption>
                <DataNumber variant="cyan" size="lg">$84.200</DataNumber>
              </div>
              <div className="flex flex-col gap-2">
                <Caption>Protein · mint</Caption>
                <DataNumber variant="mint" size="lg">128g</DataNumber>
              </div>
              <div className="flex flex-col gap-2">
                <Caption>Over limit · coral</Caption>
                <DataNumber variant="coral" size="lg">92%</DataNumber>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* COLOR ----------------------------------------------------------- */}
        <section id="color" className="mb-32 scroll-mt-24">
          <SectionLabel kicker="02 — Color" title="Tokenized for intent, not for hex.">
            Every color is exposed as a Tailwind utility under a semantic prefix
            (<code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">canvas-*</code>,
            <code className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">accent-*</code>,
            <code className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">warn-*</code>) so authoring intent reads at a glance.
          </SectionLabel>

          <GlassCard className="p-10">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {colorTokens.map((c) => (
                <ColorSwatch key={c.name} {...c} />
              ))}
            </div>
            <div className="mt-10 grid gap-4 border-t border-hairline pt-8 md:grid-cols-2">
              <div className="flex h-24 items-center justify-center rounded-2xl bg-accent-gradient font-display text-sm font-bold text-canvas-base shadow-glow-cyan">
                bg-accent-gradient · cyan → mint
              </div>
              <div className="flex h-24 items-center justify-center rounded-2xl bg-warn-gradient font-display text-sm font-bold text-canvas-base shadow-glow-coral">
                bg-warn-gradient · orange → coral
              </div>
            </div>
          </GlassCard>
        </section>

        {/* BUTTONS --------------------------------------------------------- */}
        <section id="buttons" className="mb-32 scroll-mt-24">
          <SectionLabel kicker="03 — Buttons" title="Four variants. Three sizes. Alive on hover.">
            Hover any button — scale lifts to 1.02–1.03, a colored glow blooms behind, and the
            press settles back to 0.97 with the same easing curve. Disabled state drops opacity
            to 40% and disables pointer events.
          </SectionLabel>

          <GlassCard className="space-y-10 p-10">
            <div className="flex flex-col gap-5">
              <Caption>Primary · accent gradient + cyan glow</Caption>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" size="sm">Generate List</Button>
                <Button variant="primary" size="md">Generate Weekly List</Button>
                <Button variant="primary" size="lg">Generate Optimized Weekly List</Button>
                <Button variant="primary" disabled>Disabled</Button>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <Caption>Secondary · elevated glass</Caption>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="secondary" size="sm">Edit</Button>
                <Button variant="secondary" size="md">Edit Profile</Button>
                <Button variant="secondary" size="lg">Edit Profile & Goals</Button>
                <Button variant="secondary" disabled>Disabled</Button>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <Caption>Outline · cyan border, fills on hover</Caption>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="outline" size="sm">Skip</Button>
                <Button variant="outline" size="md">Skip for Now</Button>
                <Button variant="outline" size="lg">Skip This Week</Button>
                <Button variant="outline" disabled>Disabled</Button>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <Caption>Ghost · invisible, surfaces on hover</Caption>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="ghost" size="sm">Cancel</Button>
                <Button variant="ghost" size="md">Cancel Onboarding</Button>
                <Button variant="ghost" size="lg">Cancel and Sign Out</Button>
                <Button variant="ghost" disabled>Disabled</Button>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* FORM INPUTS ----------------------------------------------------- */}
        <section id="forms" className="mb-32 scroll-mt-24">
          <SectionLabel kicker="04 — Form Inputs" title="Glass surfaces, cyan focus rings.">
            All inputs share a single visual language: 5%-opacity surface, hairline border,
            cyan focus glow, 300ms transition. The slider sports a custom glowing thumb and
            cyan→mint track fill that tracks the value live.
          </SectionLabel>

          <GlassCard className="space-y-8 p-10">
            <div className="grid gap-6 md:grid-cols-2">
              <Input
                label="Weekly Budget"
                placeholder="e.g. 65000"
                trailingAddon="ARS"
                helperText="Average household spends ~$70.000 / week."
              />
              <Input label="Email" placeholder="you@fitlist.app" type="email" />
              <Select
                label="Dietary Preference"
                options={dietaryOptions}
                helperText="Drives the macro-to-food matching algorithm."
              />
              <Select
                label="Preferred Supermarket"
                options={supermarketOptions}
                helperText="We scrape live prices from your selection."
              />
            </div>

            <div className="border-t border-hairline pt-8">
              <div className="grid gap-10 md:grid-cols-2">
                <Slider
                  label="Budget Limit (ARS)"
                  min={20000}
                  max={250000}
                  step={5000}
                  defaultValue={85000}
                  formatValue={(v) => `$${v.toLocaleString('es-AR')}`}
                />
                <Slider
                  label="Target Body Weight"
                  min={45}
                  max={140}
                  step={1}
                  defaultValue={78}
                  unit="kg"
                />
              </div>
            </div>
          </GlassCard>
        </section>

        {/* CARDS ----------------------------------------------------------- */}
        <section id="cards" className="mb-32 scroll-mt-24">
          <SectionLabel kicker="05 — Cards" title="Glassmorphism, with a satisfying check-off.">
            Tap the
            <span className="mx-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-white/5 align-middle text-[11px] text-white/70">+</span>
            on any grocery card — strikethrough sweeps in, the item dims, and the tile rotates
            slightly. This is the same interaction used on the real shopping list screen.
          </SectionLabel>

          <div className="grid gap-5 md:grid-cols-2">
            <GroceryCard
              title="Pechuga de Pollo · 500g"
              store="Carrefour Express"
              price="$8.450"
              macro="165 kcal · 31g protein"
              emoji="🍗"
              accent="from-accent-cyan to-accent-mint"
            />
            <GroceryCard
              title="Avena Quaker · 1kg"
              store="Coto"
              price="$3.290"
              macro="389 kcal · 13g protein"
              emoji="🥣"
              accent="from-accent-mint to-accent-cyan"
            />
            <GroceryCard
              title="Salmón Rosado · 300g"
              store="Jumbo"
              price="$12.800"
              macro="208 kcal · 22g protein"
              emoji="🐟"
              accent="from-accent-cyan to-accent-mint"
            />
            <GroceryCard
              title="Palta Hass · x4"
              store="Día"
              price="$4.150"
              macro="160 kcal · 2g protein"
              emoji="🥑"
              accent="from-warn-orange to-warn-coral"
            />
          </div>
        </section>

        {/* DATA VIZ -------------------------------------------------------- */}
        <section id="data" className="mb-32 scroll-mt-24">
          <SectionLabel kicker="06 — Data Visualization" title="Radial rings that pop on dark.">
            Each ring fills from 0 to its target value on mount with a 1.2s premium ease.
            Ring color shifts variant based on context — cyan for budget, mint for goals hit,
            coral when you&apos;re inside the danger zone (&gt; 90% spend or over a macro cap).
          </SectionLabel>

          <GlassCard className="p-10">
            <div className="grid gap-10 md:grid-cols-3">
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-white/[0.02] p-8">
                <RadialProgress value={68} label="Budget Used" variant="cyan" sublabel="of $85.000" />
                <Caption>Healthy</Caption>
              </div>
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-white/[0.02] p-8">
                <RadialProgress value={84} label="Protein Goal" variant="mint" sublabel="128 / 152 g" />
                <Caption>On track</Caption>
              </div>
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-white/[0.02] p-8">
                <RadialProgress value={95} label="Calorie Limit" variant="coral" sublabel="2380 / 2500 kcal" />
                <Caption>Near limit</Caption>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* FOOTER ---------------------------------------------------------- */}
        <footer className="mt-24 flex flex-col items-center gap-3 border-t border-hairline pt-12 text-center">
          <span className="font-display text-base font-extrabold tracking-tightest">
            Fit<span className="bg-accent-gradient bg-clip-text text-transparent">List</span>
          </span>
          <Caption>
            Built on Next.js · Tailwind · React · Supabase · Vercel
          </Caption>
          <span className="font-sans text-xs text-white/35">
            Brand tokens live in <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-accent-cyan">tailwind.config.js</code>.
            Glass utilities live in <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-accent-cyan">app/globals.css</code>.
          </span>
        </footer>
      </div>
    </main>
  );
}
