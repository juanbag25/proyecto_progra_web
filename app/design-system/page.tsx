'use client';

import { useState } from 'react';
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
import { NumberInput } from '@/components/ui/NumberInput';
import { Modal } from '@/components/ui/Modal';
import { Sheet } from '@/components/ui/Sheet';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { SwipeableCard } from '@/components/ui/SwipeableCard';

const colorTokens = [
  {
    name: 'Midnight Blue',
    hex: '#0A0F1A',
    role: 'canvas / base',
    swatchClassName: 'bg-canvas-base',
  },
  {
    name: 'Rich Charcoal',
    hex: '#121212',
    role: 'canvas / raised',
    swatchClassName: 'bg-canvas-raised',
  },
  {
    name: 'Elevated Gray',
    hex: '#1E1E24',
    role: 'canvas / elevated',
    swatchClassName: 'bg-canvas-elevated',
  },
  {
    name: 'Electric Cyan',
    hex: '#00F0FF',
    role: 'accent / primary',
    swatchClassName: 'bg-accent-cyan',
  },
  {
    name: 'Vibrant Mint',
    hex: '#00E676',
    role: 'accent / success',
    swatchClassName: 'bg-accent-mint',
  },
  { name: 'Coral', hex: '#FF6B6B', role: 'warn / over-budget', swatchClassName: 'bg-warn-coral' },
  {
    name: 'Action Orange',
    hex: '#FF8E53',
    role: 'warn / milestone',
    swatchClassName: 'bg-warn-orange',
  },
  {
    name: 'Hairline',
    hex: 'rgba(255,255,255,0.05)',
    role: 'border / subtle',
    swatchClassName: 'bg-white/[0.05]',
  },
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

function SectionLabel({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-col gap-3">
      <H5>{kicker}</H5>
      <H2>{title}</H2>
      {children && <Body className="max-w-2xl">{children}</Body>}
    </header>
  );
}

function ToastDemo() {
  const { show } = useToast();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="primary"
        size="md"
        onClick={() => show({ message: 'Boom! Macros locked for the week.', variant: 'success' })}
      >
        Trigger success
      </Button>
      <Button
        variant="outline"
        size="md"
        onClick={() =>
          show({ message: 'Live prices on Carrefour just refreshed.', variant: 'info' })
        }
      >
        Trigger info
      </Button>
      <Button
        variant="secondary"
        size="md"
        onClick={() =>
          show({
            message:
              'Budget exceeded — try lowering the protein floor or expanding the supermarket pool.',
            variant: 'error',
          })
        }
      >
        Trigger error
      </Button>
      <Caption>Auto-dismiss in 4s · stack accumulates · click × to drop early.</Caption>
    </div>
  );
}

const swipeSamples = [
  {
    title: 'Pechuga de Pollo · 500g',
    store: 'Carrefour Express',
    price: '$8.450',
    macro: '165 kcal · 31g protein',
    emoji: '🍗',
  },
  {
    title: 'Salmón Rosado · 300g',
    store: 'Jumbo',
    price: '$12.800',
    macro: '208 kcal · 22g protein',
    emoji: '🐟',
  },
  {
    title: 'Avena Quaker · 1kg',
    store: 'Coto',
    price: '$3.290',
    macro: '389 kcal · 13g protein',
    emoji: '🥣',
  },
];

function SwipeableDemo() {
  const { show } = useToast();
  const [index, setIndex] = useState(0);
  const sample = swipeSamples[index % swipeSamples.length];

  const next = () => setIndex((i) => i + 1);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="flex w-full max-w-md items-center justify-between font-display text-xs uppercase tracking-widest text-white/45">
        <span>← swipe to discard</span>
        <span>swipe to approve →</span>
      </div>
      <SwipeableCard
        key={index}
        onSwipeLeft={() => {
          show({ message: `Discarded ${sample.title}`, variant: 'error' });
          next();
        }}
        onSwipeRight={() => {
          show({ message: `Approved ${sample.title}`, variant: 'success' });
          next();
        }}
      >
        <GlassCard
          variant="strong"
          className="flex w-[min(90vw,22rem)] flex-col gap-3 border border-hairline shadow-glow-cyan"
        >
          <div className="flex items-center justify-between">
            <span className="text-3xl" aria-hidden>
              {sample.emoji}
            </span>
            <Caption>{sample.store}</Caption>
          </div>
          <H4>{sample.title}</H4>
          <Body className="text-sm text-white/65">{sample.macro}</Body>
          <span className="tabular font-display text-2xl font-bold text-accent-cyan">
            {sample.price}
          </span>
        </GlassCard>
      </SwipeableCard>
      <Caption>
        Card #{(index % swipeSamples.length) + 1} of {swipeSamples.length}
      </Caption>
    </div>
  );
}

export default function DesignSystemPage() {
  const [weight, setWeight] = useState(78);
  const [budget, setBudget] = useState(85000);
  const [overflowDemo, setOverflowDemo] = useState(150);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <ToastProvider>
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
              <a
                href="#typography"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Typography
              </a>
              <a
                href="#color"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Color
              </a>
              <a
                href="#buttons"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Buttons
              </a>
              <a
                href="#forms"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Forms
              </a>
              <a
                href="#cards"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Cards
              </a>
              <a
                href="#data"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Data
              </a>
              <a
                href="#numberinput"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Number
              </a>
              <a
                href="#modal"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Modal
              </a>
              <a
                href="#sheet"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Sheet
              </a>
              <a
                href="#toast"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Toast
              </a>
              <a
                href="#swipeable"
                className="rounded-full px-3 py-1.5 font-sans text-xs text-white/60 transition hover:text-white"
              >
                Swipe
              </a>
            </div>
            <Button variant="outline" size="sm">
              v0.1.0
            </Button>
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
              The visual{' '}
              <span className="bg-accent-gradient bg-clip-text text-transparent">language</span> of
              FitList.
            </H1>
            <Body className="mt-6 max-w-2xl text-lg">
              A premium, dark-mode design system built for nutritional intelligence at scale. Every
              primitive on this page is a real, production-ready React component — wired to
              tokenized brand colors, Outfit + Inter typography, glassmorphism, and 300ms
              cubic-bezier micro-animations.
            </Body>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <GlassCard variant="strong">
                <Caption>Built on</Caption>
                <H4 className="mt-2">Next.js + Tailwind</H4>
                <Body className="mt-2 text-sm">
                  App Router, TypeScript, zero runtime CSS-in-JS. Brand tokens live in
                  <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">
                    tailwind.config.js
                  </code>
                  .
                </Body>
              </GlassCard>
              <GlassCard variant="strong">
                <Caption>Aesthetic</Caption>
                <H4 className="mt-2">Premium · Dynamic</H4>
                <Body className="mt-2 text-sm">
                  Inspired by Nike Run Club & Apple Fitness — sleek, alive, trustworthy. No generic
                  medical-app vibes anywhere on this surface.
                </Body>
              </GlassCard>
              <GlassCard variant="strong">
                <Caption>Animation</Caption>
                <H4 className="mt-2">300ms · ease-premium</H4>
                <Body className="mt-2 text-sm">
                  Custom{' '}
                  <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">
                    cubic-bezier(0.16, 1, 0.3, 1)
                  </code>{' '}
                  applied to every hover, focus, and state change.
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
                  <DataNumber variant="cyan" size="lg">
                    $84.200
                  </DataNumber>
                </div>
                <div className="flex flex-col gap-2">
                  <Caption>Protein · mint</Caption>
                  <DataNumber variant="mint" size="lg">
                    128g
                  </DataNumber>
                </div>
                <div className="flex flex-col gap-2">
                  <Caption>Over limit · coral</Caption>
                  <DataNumber variant="coral" size="lg">
                    92%
                  </DataNumber>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* COLOR ----------------------------------------------------------- */}
          <section id="color" className="mb-32 scroll-mt-24">
            <SectionLabel kicker="02 — Color" title="Tokenized for intent, not for hex.">
              Every color is exposed as a Tailwind utility under a semantic prefix (
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">
                canvas-*
              </code>
              ,
              <code className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">
                accent-*
              </code>
              ,
              <code className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">
                warn-*
              </code>
              ) so authoring intent reads at a glance.
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
              press settles back to 0.97 with the same easing curve. Disabled state drops opacity to
              40% and disables pointer events.
            </SectionLabel>

            <GlassCard className="space-y-10 p-10">
              <div className="flex flex-col gap-5">
                <Caption>Primary · accent gradient + cyan glow</Caption>
                <div className="flex flex-wrap items-center gap-4">
                  <Button variant="primary" size="sm">
                    Generate List
                  </Button>
                  <Button variant="primary" size="md">
                    Generate Weekly List
                  </Button>
                  <Button variant="primary" size="lg">
                    Generate Optimized Weekly List
                  </Button>
                  <Button variant="primary" disabled>
                    Disabled
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <Caption>Secondary · elevated glass</Caption>
                <div className="flex flex-wrap items-center gap-4">
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                  <Button variant="secondary" size="md">
                    Edit Profile
                  </Button>
                  <Button variant="secondary" size="lg">
                    Edit Profile & Goals
                  </Button>
                  <Button variant="secondary" disabled>
                    Disabled
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <Caption>Outline · cyan border, fills on hover</Caption>
                <div className="flex flex-wrap items-center gap-4">
                  <Button variant="outline" size="sm">
                    Skip
                  </Button>
                  <Button variant="outline" size="md">
                    Skip for Now
                  </Button>
                  <Button variant="outline" size="lg">
                    Skip This Week
                  </Button>
                  <Button variant="outline" disabled>
                    Disabled
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <Caption>Ghost · invisible, surfaces on hover</Caption>
                <div className="flex flex-wrap items-center gap-4">
                  <Button variant="ghost" size="sm">
                    Cancel
                  </Button>
                  <Button variant="ghost" size="md">
                    Cancel Onboarding
                  </Button>
                  <Button variant="ghost" size="lg">
                    Cancel and Sign Out
                  </Button>
                  <Button variant="ghost" disabled>
                    Disabled
                  </Button>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* FORM INPUTS ----------------------------------------------------- */}
          <section id="forms" className="mb-32 scroll-mt-24">
            <SectionLabel kicker="04 — Form Inputs" title="Glass surfaces, cyan focus rings.">
              All inputs share a single visual language: 5%-opacity surface, hairline border, cyan
              focus glow, 300ms transition. The slider sports a custom glowing thumb and cyan→mint
              track fill that tracks the value live.
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
              <span className="mx-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-white/5 align-middle text-[11px] text-white/70">
                +
              </span>
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
              Each ring fills from 0 to its target value on mount with a 1.2s premium ease. Ring
              color shifts variant based on context — cyan for budget, mint for goals hit, coral
              when you&apos;re inside the danger zone (&gt; 90% spend or over a macro cap).
            </SectionLabel>

            <GlassCard className="p-10">
              <div className="grid gap-10 md:grid-cols-3">
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-white/[0.02] p-8">
                  <RadialProgress
                    value={68}
                    label="Budget Used"
                    variant="cyan"
                    sublabel="of $85.000"
                  />
                  <Caption>Healthy</Caption>
                </div>
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-white/[0.02] p-8">
                  <RadialProgress
                    value={84}
                    label="Protein Goal"
                    variant="mint"
                    sublabel="128 / 152 g"
                  />
                  <Caption>On track</Caption>
                </div>
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-white/[0.02] p-8">
                  <RadialProgress
                    value={95}
                    label="Calorie Limit"
                    variant="coral"
                    sublabel="2380 / 2500 kcal"
                  />
                  <Caption>Near limit</Caption>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* NUMBER INPUT ---------------------------------------------------- */}
          <section id="numberinput" className="mb-32 scroll-mt-24">
            <SectionLabel kicker="07 — Number Input" title="Type, click, or step. Always tabular.">
              Steppers nudge by{' '}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">
                step
              </code>
              ; out-of-range values get a coral ring and a clear error. Tabular numerals keep digit
              columns aligned across stacked inputs.
            </SectionLabel>

            <GlassCard className="p-10">
              <div className="grid gap-6 md:grid-cols-3">
                <NumberInput
                  label="Body Weight"
                  unit="kg"
                  value={weight}
                  onChange={setWeight}
                  min={40}
                  max={200}
                  step={1}
                  helperText="Used to compute your TDEE."
                />
                <NumberInput
                  label="Weekly Budget"
                  unit="ARS"
                  value={budget}
                  onChange={setBudget}
                  min={20000}
                  max={300000}
                  step={5000}
                  helperText="Min for a viable week is ~$30.000."
                />
                <NumberInput
                  label="Out-of-Range Demo"
                  unit="kg"
                  value={overflowDemo}
                  onChange={setOverflowDemo}
                  min={50}
                  max={120}
                  step={1}
                  helperText="Lower or raise it past the bounds — the field rings coral."
                />
              </div>
            </GlassCard>
          </section>

          {/* MODAL ----------------------------------------------------------- */}
          <section id="modal" className="mb-32 scroll-mt-24">
            <SectionLabel kicker="08 — Modal" title="Native dialog, glass content.">
              Built on the platform{' '}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-accent-cyan">
                &lt;dialog&gt;
              </code>{' '}
              element so it inherits free focus-trap and ARIA wiring. ESC closes it. Click anywhere
              outside the glass card closes it. Fades + scales in over 200ms.
            </SectionLabel>

            <GlassCard className="p-10">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <H4>Confirm Weekly Plan</H4>
                  <Body className="mt-2 max-w-md text-sm">
                    Open a centered modal with a confirmation flow.
                  </Body>
                </div>
                <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
                  Open Modal
                </Button>
              </div>
            </GlassCard>

            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirm Weekly Plan">
              <Body className="text-sm text-white/75">
                We&apos;ll generate a fresh shopping list for next week using your latest weight and
                the live prices we scraped this morning. Heads up — you can&apos;t undo this once we
                lock the plan.
              </Body>
              <div className="mt-8 flex justify-end gap-3">
                <Button variant="ghost" size="md" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" onClick={() => setModalOpen(false)}>
                  Lock the plan
                </Button>
              </div>
            </Modal>
          </section>

          {/* SHEET ----------------------------------------------------------- */}
          <section id="sheet" className="mb-32 scroll-mt-24">
            <SectionLabel kicker="09 — Sheet" title="Slides up from the bottom edge.">
              Mobile-first variant of Modal — anchors to the bottom of the viewport with a gentle
              drag handle. Same glass surface, same close behavior. Used for filters, quick edits,
              and inline forms.
            </SectionLabel>

            <GlassCard className="p-10">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <H4>Adjust Weekly Goal</H4>
                  <Body className="mt-2 max-w-md text-sm">
                    Open a bottom sheet with a quick form.
                  </Body>
                </div>
                <Button variant="secondary" size="md" onClick={() => setSheetOpen(true)}>
                  Open Sheet
                </Button>
              </div>
            </GlassCard>

            <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Adjust Weekly Goal">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Calorie Target" placeholder="2400" trailingAddon="kcal" />
                <Input label="Protein Target" placeholder="160" trailingAddon="g" />
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <Button variant="ghost" size="md" onClick={() => setSheetOpen(false)}>
                  Discard
                </Button>
                <Button variant="primary" size="md" onClick={() => setSheetOpen(false)}>
                  Save
                </Button>
              </div>
            </Sheet>
          </section>

          {/* TOAST ----------------------------------------------------------- */}
          <section id="toast" className="mb-32 scroll-mt-24">
            <SectionLabel kicker="10 — Toast" title="Ephemeral, non-blocking, three flavors.">
              Stack of glass notifications anchored bottom-right (desktop) or bottom-center
              (mobile). Auto-dismiss in 4s with a visible progress bar; click the × to dismiss
              early.
            </SectionLabel>

            <GlassCard className="p-10">
              <ToastDemo />
            </GlassCard>
          </section>

          {/* SWIPEABLE CARD -------------------------------------------------- */}
          <section id="swipeable" className="mb-32 scroll-mt-24">
            <SectionLabel
              kicker="11 — Swipeable Card"
              title="Drag right to approve, left to discard."
            >
              Pointer-event gesture handler — works with mouse, touch, and pen. Threshold 80px;
              crossing it animates the card off-screen and fires the matching callback. Reduced-
              motion users get a static card with no drag visual.
            </SectionLabel>

            <GlassCard className="p-10">
              <SwipeableDemo />
            </GlassCard>
          </section>

          {/* FOOTER ---------------------------------------------------------- */}
          <footer className="mt-24 flex flex-col items-center gap-3 border-t border-hairline pt-12 text-center">
            <span className="font-display text-base font-extrabold tracking-tightest">
              Fit<span className="bg-accent-gradient bg-clip-text text-transparent">List</span>
            </span>
            <Caption>Built on Next.js · Tailwind · React · Supabase · Vercel</Caption>
            <span className="font-sans text-xs text-white/35">
              Brand tokens live in{' '}
              <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-accent-cyan">
                tailwind.config.js
              </code>
              . Glass utilities live in{' '}
              <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-accent-cyan">
                app/globals.css
              </code>
              .
            </span>
          </footer>
        </div>
      </main>
    </ToastProvider>
  );
}
